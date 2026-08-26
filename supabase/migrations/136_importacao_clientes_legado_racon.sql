-- 136: importação auditável de clientes/cotas legadas Racon.
-- Registros legados integram carteira, lances e contemplações, mas nunca faturamento da empresa.
BEGIN;

ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_origem_check;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_origem_check
  CHECK (origem IN ('manual', 'contratacao_assinada', 'importacao_legado'));
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS pendencias_cadastro text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.clientes_historico DROP CONSTRAINT IF EXISTS clientes_historico_tipo_evento_check;
ALTER TABLE public.clientes_historico ADD CONSTRAINT clientes_historico_tipo_evento_check
  CHECK (tipo_evento IN (
    'cliente_criado', 'cliente_atualizado', 'contrato_assinado', 'cota_vinculada',
    'cliente_inativado', 'importacao_legado'
  ));

ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS origem_registro text NOT NULL DEFAULT 'OPERACIONAL',
  ADD COLUMN IF NOT EXISTS afeta_faturamento boolean NOT NULL DEFAULT true;
ALTER TABLE public.vendas DROP CONSTRAINT IF EXISTS vendas_origem_registro_check;
ALTER TABLE public.vendas ADD CONSTRAINT vendas_origem_registro_check
  CHECK (origem_registro IN ('OPERACIONAL', 'IMPORTACAO_LEGADO'));
CREATE INDEX IF NOT EXISTS vendas_empresa_faturamento_idx
  ON public.vendas (empresa_id, afeta_faturamento, status, data_venda);

ALTER TABLE public.cotas_definitivas
  ADD COLUMN IF NOT EXISTS origem_registro text NOT NULL DEFAULT 'OPERACIONAL';
ALTER TABLE public.cotas_definitivas DROP CONSTRAINT IF EXISTS cotas_origem_registro_check;
ALTER TABLE public.cotas_definitivas ADD CONSTRAINT cotas_origem_registro_check
  CHECK (origem_registro IN ('OPERACIONAL', 'IMPORTACAO_LEGADO'));

ALTER TABLE public.comissao_previsoes_participantes
  ADD COLUMN IF NOT EXISTS origem_registro text NOT NULL DEFAULT 'OPERACIONAL';
ALTER TABLE public.comissao_previsoes_participantes DROP CONSTRAINT IF EXISTS comissao_prev_part_origem_check;
ALTER TABLE public.comissao_previsoes_participantes ADD CONSTRAINT comissao_prev_part_origem_check
  CHECK (origem_registro IN ('OPERACIONAL', 'IMPORTACAO_LEGADO'));

CREATE TABLE IF NOT EXISTS public.importacao_clientes_legado_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  administradora_id uuid NOT NULL REFERENCES public.administradoras(id) ON DELETE RESTRICT,
  regra_franquia_id uuid REFERENCES public.comissao_regras_franquia(id) ON DELETE RESTRICT,
  participante_comercial_id uuid REFERENCES public.participantes_comerciais(id) ON DELETE RESTRICT,
  arquivo_nome text NOT NULL,
  arquivo_hash text NOT NULL,
  idempotency_key text NOT NULL,
  sem_comissao boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'PROCESSANDO'
    CHECK (status IN ('PROCESSANDO', 'CONCLUIDO', 'FALHOU', 'CANCELADO')),
  total_linhas integer NOT NULL CHECK (total_linhas > 0),
  total_importadas integer NOT NULL DEFAULT 0,
  total_pendencias integer NOT NULL DEFAULT 0,
  total_previsoes_futuras integer NOT NULL DEFAULT 0,
  configuracao_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (empresa_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.importacao_clientes_legado_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.importacao_clientes_legado_lotes(id) ON DELETE RESTRICT,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  linha integer NOT NULL CHECK (linha > 1),
  cliente_nome text NOT NULL,
  documento_original text,
  telefone_original text,
  bem text NOT NULL,
  data_contrato date NOT NULL,
  numero_grupo text NOT NULL,
  numero_cota text NOT NULL,
  valor_credito numeric(15,2) NOT NULL CHECK (valor_credito > 0),
  pendencias text[] NOT NULL DEFAULT '{}'::text[],
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE RESTRICT,
  venda_id uuid REFERENCES public.vendas(id) ON DELETE RESTRICT,
  cota_definitiva_id uuid REFERENCES public.cotas_definitivas(id) ON DELETE RESTRICT,
  previsoes_futuras integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'IMPORTADO' CHECK (status IN ('IMPORTADO', 'ERRO')),
  detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lote_id, linha)
);
CREATE UNIQUE INDEX IF NOT EXISTS importacao_legado_cota_unica_idx
  ON public.importacao_clientes_legado_itens (empresa_id, numero_grupo, numero_cota)
  WHERE status = 'IMPORTADO';
CREATE INDEX IF NOT EXISTS importacao_legado_lotes_empresa_idx
  ON public.importacao_clientes_legado_lotes (empresa_id, created_at DESC);

ALTER TABLE public.importacao_clientes_legado_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacao_clientes_legado_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY importacao_legado_lotes_read ON public.importacao_clientes_legado_lotes
  FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
CREATE POLICY importacao_legado_itens_read ON public.importacao_clientes_legado_itens
  FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
REVOKE ALL ON TABLE public.importacao_clientes_legado_lotes, public.importacao_clientes_legado_itens FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.importacao_clientes_legado_lotes, public.importacao_clientes_legado_itens TO authenticated;
GRANT ALL ON TABLE public.importacao_clientes_legado_lotes, public.importacao_clientes_legado_itens TO service_role;

CREATE OR REPLACE FUNCTION public.data_parcela_legado(p_data_contrato date, p_numero_parcela integer)
RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
BEGIN
  IF p_data_contrato IS NULL OR p_numero_parcela IS NULL OR p_numero_parcela < 1 THEN
    RAISE EXCEPTION 'Data do contrato e número da parcela são obrigatórios';
  END IF;
  IF p_numero_parcela = 1 THEN RETURN p_data_contrato; END IF;
  RETURN make_date(
    extract(year FROM (date_trunc('month', p_data_contrato)::date
      + ((p_numero_parcela - CASE WHEN extract(day FROM p_data_contrato) <= 10 THEN 1 ELSE 0 END) || ' months')::interval))::integer,
    extract(month FROM (date_trunc('month', p_data_contrato)::date
      + ((p_numero_parcela - CASE WHEN extract(day FROM p_data_contrato) <= 10 THEN 1 ELSE 0 END) || ' months')::interval))::integer,
    10
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_importar_clientes_legado_racon(
  p_empresa_id uuid,
  p_arquivo_nome text,
  p_arquivo_hash text,
  p_idempotency_key text,
  p_itens jsonb,
  p_regra_franquia_id uuid DEFAULT NULL,
  p_participante_comercial_id uuid DEFAULT NULL,
  p_sem_comissao boolean DEFAULT false,
  p_data_referencia date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_lote public.importacao_clientes_legado_lotes%ROWTYPE;
  v_admin public.administradoras%ROWTYPE;
  v_regra record;
  v_item jsonb;
  v_grupo public.grupos_consorcio%ROWTYPE;
  v_produto public.grupos_cotas%ROWTYPE;
  v_cliente public.clientes%ROWTYPE;
  v_venda public.vendas%ROWTYPE;
  v_cota public.cotas_definitivas%ROWTYPE;
  v_etapa public.comissao_regra_etapas%ROWTYPE;
  v_documento text;
  v_telefone text;
  v_pendencias text[];
  v_data_contrato date;
  v_data_pagamento date;
  v_valor numeric;
  v_parcela numeric;
  v_imposto numeric := 0;
  v_bruto numeric;
  v_imposto_valor numeric;
  v_liquido numeric;
  v_modalidade_id uuid;
  v_previsoes integer;
  v_importadas integer := 0;
  v_total_pendencias integer := 0;
  v_total_previsoes integer := 0;
  v_linha integer;
BEGIN
  IF NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado ao tenant'; END IF;
  IF jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN RAISE EXCEPTION 'Arquivo sem linhas para importar'; END IF;
  IF NULLIF(trim(p_idempotency_key), '') IS NULL THEN RAISE EXCEPTION 'Chave de idempotência obrigatória'; END IF;
  IF NOT p_sem_comissao AND (p_regra_franquia_id IS NULL OR p_participante_comercial_id IS NULL) THEN
    RAISE EXCEPTION 'Regra e beneficiário são obrigatórios para gerar comissões futuras';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text || ':IMPORTACAO_LEGADO:' || p_idempotency_key, 0));
  SELECT * INTO v_lote FROM public.importacao_clientes_legado_lotes
    WHERE empresa_id = p_empresa_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('lote_id', v_lote.id, 'idempotente', true, 'total_importadas', v_lote.total_importadas,
      'total_pendencias', v_lote.total_pendencias, 'total_previsoes_futuras', v_lote.total_previsoes_futuras);
  END IF;

  SELECT * INTO v_admin FROM public.administradoras
    WHERE status = 'ATIVA' AND regexp_replace(upper(coalesce(nome_fantasia, nome, '')), '[^A-Z0-9]', '', 'g') LIKE '%RACON%'
    ORDER BY created_at LIMIT 1;
  IF v_admin.id IS NULL THEN RAISE EXCEPTION 'Administradora Racon ativa não encontrada'; END IF;
  IF NOT public.grupo_concedido_para_empresa(p_empresa_id, (SELECT id FROM public.grupos_consorcio WHERE administradora_id=v_admin.id LIMIT 1)) THEN
    RAISE EXCEPTION 'A Racon não está concedida à empresa ativa';
  END IF;

  IF NOT p_sem_comissao THEN
    SELECT r.*, p.administradora_id INTO v_regra
    FROM public.comissao_regras_franquia r
    JOIN public.comissao_programas p ON p.id = r.programa_id
    WHERE r.id = p_regra_franquia_id AND r.empresa_id = p_empresa_id AND p.administradora_id = v_admin.id;
    IF v_regra.id IS NULL THEN RAISE EXCEPTION 'Regra de comissão Racon não pertence à empresa'; END IF;
    v_modalidade_id := v_regra.modalidade_comissao_id;
    IF NOT EXISTS (SELECT 1 FROM public.participantes_comerciais pc WHERE pc.id=p_participante_comercial_id AND pc.empresa_id=p_empresa_id AND pc.status='ATIVO') THEN
      RAISE EXCEPTION 'Beneficiário da comissão não pertence à empresa ou está inativo';
    END IF;
  END IF;

  INSERT INTO public.importacao_clientes_legado_lotes(
    empresa_id, administradora_id, regra_franquia_id, participante_comercial_id,
    arquivo_nome, arquivo_hash, idempotency_key, sem_comissao, total_linhas,
    configuracao_snapshot, criado_por_usuario_id
  ) VALUES (
    p_empresa_id, v_admin.id, p_regra_franquia_id, p_participante_comercial_id,
    trim(p_arquivo_nome), p_arquivo_hash, p_idempotency_key, p_sem_comissao,
    jsonb_array_length(p_itens), jsonb_build_object('data_referencia',p_data_referencia,'regra_id',p_regra_franquia_id),
    public.current_usuario_id()
  ) RETURNING * INTO v_lote;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
    v_linha := (v_item->>'linha')::integer;
    v_data_contrato := (v_item->>'data_contrato')::date;
    v_valor := (v_item->>'valor_credito')::numeric;
    v_documento := regexp_replace(coalesce(v_item->>'cpf_cnpj',''), '[^0-9]', '', 'g');
    v_telefone := regexp_replace(coalesce(v_item->>'telefone',''), '[^0-9]', '', 'g');
    v_pendencias := '{}'::text[];
    IF length(v_documento) NOT IN (11,14) THEN v_documento := NULL; v_pendencias := array_append(v_pendencias,'PENDENTE_CPF_CNPJ'); END IF;
    IF length(v_telefone) < 10 THEN v_telefone := NULL; v_pendencias := array_append(v_pendencias,'PENDENTE_TELEFONE'); END IF;
    IF NULLIF(trim(v_item->>'cliente_nome'),'') IS NULL OR v_data_contrato IS NULL OR v_valor <= 0 THEN RAISE EXCEPTION 'Linha % possui campos obrigatórios inválidos',v_linha; END IF;

    SELECT * INTO v_grupo FROM public.grupos_consorcio
      WHERE administradora_id=v_admin.id AND trim(codigo_grupo)=trim(v_item->>'grupo') AND ativo LIMIT 1;
    IF v_grupo.id IS NULL THEN RAISE EXCEPTION 'Linha %: grupo Racon % não encontrado/ativo',v_linha,v_item->>'grupo'; END IF;
    IF NOT public.grupo_concedido_para_empresa(p_empresa_id,v_grupo.id) THEN RAISE EXCEPTION 'Linha %: grupo % não concedido à empresa',v_linha,v_item->>'grupo'; END IF;
    SELECT * INTO v_produto FROM public.grupos_cotas
      WHERE grupo_id=v_grupo.id AND ativo ORDER BY abs(valor_credito-v_valor), ordem, created_at LIMIT 1;
    IF v_produto.id IS NULL THEN RAISE EXCEPTION 'Linha %: grupo % não possui produto/cota comercial ativo',v_linha,v_item->>'grupo'; END IF;
    v_parcela := greatest(coalesce(v_produto.valor_parcela,v_produto.parcela_integral,v_valor/nullif(v_grupo.prazo_total,0),1),0.01);

    v_cliente.id := NULL;
    IF v_documento IS NOT NULL THEN
      SELECT * INTO v_cliente FROM public.clientes WHERE empresa_id=p_empresa_id AND documento_normalizado=v_documento LIMIT 1;
    ELSIF v_telefone IS NOT NULL THEN
      SELECT * INTO v_cliente FROM public.clientes WHERE empresa_id=p_empresa_id
        AND regexp_replace(coalesce(telefone,''),'[^0-9]','','g')=v_telefone ORDER BY created_at LIMIT 1;
    END IF;
    IF v_cliente.id IS NULL THEN
      INSERT INTO public.clientes(empresa_id,tipo_pessoa,nome,cpf_cnpj,documento_normalizado,telefone,origem,pendencias_cadastro,observacoes)
      VALUES(p_empresa_id,CASE WHEN length(coalesce(v_documento,''))=14 THEN 'PJ' ELSE 'PF' END,trim(v_item->>'cliente_nome'),v_documento,v_documento,v_telefone,'importacao_legado',v_pendencias,'Importado da carteira histórica Racon.')
      RETURNING * INTO v_cliente;
    ELSE
      UPDATE public.clientes SET
        telefone=coalesce(telefone,v_telefone),
        pendencias_cadastro=(SELECT array_agg(DISTINCT x) FROM unnest(coalesce(pendencias_cadastro,'{}')||v_pendencias) x),
        updated_at=now()
      WHERE id=v_cliente.id RETURNING * INTO v_cliente;
    END IF;

    INSERT INTO public.vendas(
      empresa_id,cliente_id,cliente_nome,cliente_cpf_cnpj,cliente_telefone,administradora_id,grupo_id,
      opcao_cota_id,participante_comercial_id,valor_credito,prazo,parcela,status,snapshot_venda,data_venda,
      modalidade_comissao_id,origem_registro,afeta_faturamento
    ) VALUES(
      p_empresa_id,v_cliente.id,v_cliente.nome,v_documento,v_telefone,v_admin.id,v_grupo.id,v_produto.id,
      p_participante_comercial_id,v_valor,greatest(coalesce(v_grupo.prazo_restante,v_grupo.prazo_total,1),1),v_parcela,'confirmada',
      jsonb_build_object('origem','IMPORTACAO_LEGADO','afeta_faturamento',false,'valor_credito_contratado',v_valor,
        'numero_grupo',trim(v_item->>'grupo'),'numero_cota',trim(v_item->>'cota'),'bem',trim(v_item->>'bem'),
        'data_contrato',v_data_contrato,'regra_historica_id',p_regra_franquia_id),
      v_data_contrato::timestamptz,coalesce(v_modalidade_id,v_grupo.modalidade_comissao_id),
      'IMPORTACAO_LEGADO',false
    ) RETURNING * INTO v_venda;

    -- A data_venda continua sendo a data histórica do contrato para auditoria e
    -- cronograma. O saldo operacional, porém, representa a posição atual do grupo.
    UPDATE public.vendas SET
      prazo=greatest(public.calcular_prazo_restante_grupo(v_grupo.id,p_data_referencia),1),
      parcelas_restantes_venda=greatest(public.calcular_prazo_restante_grupo(v_grupo.id,p_data_referencia),1),
      prazo_referencia_em=p_data_referencia,
      snapshot_venda=snapshot_venda||jsonb_build_object(
        'parcelas_restantes_venda',greatest(public.calcular_prazo_restante_grupo(v_grupo.id,p_data_referencia),1),
        'prazo_referencia_em',p_data_referencia
      )
    WHERE id=v_venda.id
    RETURNING * INTO v_venda;

    INSERT INTO public.cotas_definitivas(
      empresa_id,venda_id,administradora_id,grupo_id,numero_grupo,numero_cota,valor_credito,prazo,parcela,status,
      participante_comercial_id,snapshot_cota,origem_registro
    ) VALUES(
      p_empresa_id,v_venda.id,v_admin.id,v_grupo.id,trim(v_item->>'grupo'),trim(v_item->>'cota'),v_valor,v_venda.prazo,v_parcela,'ativa',
      p_participante_comercial_id,jsonb_build_object('origem','IMPORTACAO_LEGADO','valor_credito_contratado',v_valor,'bem',trim(v_item->>'bem')),
      'IMPORTACAO_LEGADO'
    ) RETURNING * INTO v_cota;

    v_previsoes := 0;
    IF NOT p_sem_comissao THEN
      FOR v_etapa IN SELECT * FROM public.comissao_regra_etapas
        WHERE regra_franquia_id=p_regra_franquia_id AND tipo_gatilho='MES_RELATIVO' ORDER BY ordem LOOP
        v_data_pagamento := public.data_parcela_legado(v_data_contrato,v_etapa.mes_relativo);
        IF v_data_pagamento >= p_data_referencia THEN
          SELECT coalesce(f.percentual_imposto,0) INTO v_imposto FROM public.empresa_configuracoes_fiscais f
            WHERE f.empresa_id=p_empresa_id AND f.ativo AND f.vigencia_inicio<=v_data_pagamento
              AND (f.vigencia_fim IS NULL OR f.vigencia_fim>=v_data_pagamento)
            ORDER BY f.vigencia_inicio DESC LIMIT 1;
          v_imposto := coalesce(v_imposto,0);
          v_bruto := round(v_valor*v_etapa.percentual_venda/100,2);
          v_imposto_valor := round(v_bruto*v_imposto/100,2);
          v_liquido := v_bruto-v_imposto_valor;
          INSERT INTO public.comissao_previsoes_participantes(
            empresa_id,venda_id,cota_definitiva_id,participante_comercial_id,ordem_etapa,nome_etapa,competencia,
            base_calculo_valor,percentual_aplicado,valor_previsto,status,snapshot_regra,tipo_gatilho,
            papel_tipo,origem_registro
          ) VALUES(
            p_empresa_id,v_venda.id,v_cota.id,p_participante_comercial_id,v_etapa.ordem,v_etapa.nome,to_char(v_data_pagamento,'YYYY-MM'),
            v_valor,v_etapa.percentual_venda,v_liquido,'prevista',jsonb_build_object('origem','IMPORTACAO_LEGADO',
              'regra_franquia_id',p_regra_franquia_id,'mes_relativo',v_etapa.mes_relativo,'data_pagamento',v_data_pagamento,
              'valor_bruto',v_bruto,'imposto_aliquota',v_imposto,'imposto_valor',v_imposto_valor,'valor_liquido',v_liquido,
              'direto_ao_socio',true,'afeta_faturamento_empresa',false),
            'MES_RELATIVO','SOCIO','IMPORTACAO_LEGADO'
          );
          v_previsoes := v_previsoes+1;
        END IF;
      END LOOP;
    END IF;

    INSERT INTO public.importacao_clientes_legado_itens(
      lote_id,empresa_id,linha,cliente_nome,documento_original,telefone_original,bem,data_contrato,numero_grupo,numero_cota,
      valor_credito,pendencias,cliente_id,venda_id,cota_definitiva_id,previsoes_futuras,detalhe
    ) VALUES(
      v_lote.id,p_empresa_id,v_linha,trim(v_item->>'cliente_nome'),nullif(v_item->>'cpf_cnpj',''),nullif(v_item->>'telefone',''),
      trim(v_item->>'bem'),v_data_contrato,trim(v_item->>'grupo'),trim(v_item->>'cota'),v_valor,v_pendencias,
      v_cliente.id,v_venda.id,v_cota.id,v_previsoes,jsonb_build_object('produto_catalogo_id',v_produto.id,'regra_id',p_regra_franquia_id)
    );
    INSERT INTO public.clientes_historico(empresa_id,cliente_id,tipo_evento,descricao,venda_id)
      VALUES(p_empresa_id,v_cliente.id,'importacao_legado',format('Cota histórica Racon %s/%s importada sem afetar o faturamento.',trim(v_item->>'grupo'),trim(v_item->>'cota')),v_venda.id);
    v_importadas:=v_importadas+1;
    IF cardinality(v_pendencias)>0 THEN v_total_pendencias:=v_total_pendencias+1; END IF;
    v_total_previsoes:=v_total_previsoes+v_previsoes;
  END LOOP;

  UPDATE public.importacao_clientes_legado_lotes SET status='CONCLUIDO',total_importadas=v_importadas,
    total_pendencias=v_total_pendencias,total_previsoes_futuras=v_total_previsoes,completed_at=now()
    WHERE id=v_lote.id;
  RETURN jsonb_build_object('lote_id',v_lote.id,'idempotente',false,'total_importadas',v_importadas,
    'total_pendencias',v_total_pendencias,'total_previsoes_futuras',v_total_previsoes);
END;
$$;

REVOKE ALL ON FUNCTION public.data_parcela_legado(date,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.data_parcela_legado(date,integer) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_importar_clientes_legado_racon(uuid,text,text,text,jsonb,uuid,uuid,boolean,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_importar_clientes_legado_racon(uuid,text,text,text,jsonb,uuid,uuid,boolean,date) TO authenticated, service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
