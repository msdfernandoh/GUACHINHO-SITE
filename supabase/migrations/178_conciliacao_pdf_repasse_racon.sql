-- 178: Importação e conciliação auditável do PDF de repasse Racon.
BEGIN;

CREATE TABLE public.erp_repasse_importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  administradora_id uuid NOT NULL REFERENCES public.administradoras(id) ON DELETE RESTRICT,
  competencia varchar(7) NOT NULL CHECK (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  arquivo_nome text NOT NULL,
  arquivo_path text NOT NULL,
  arquivo_hash text NOT NULL,
  valor_total_bruto numeric(15,2) NOT NULL CHECK (valor_total_bruto > 0),
  ponto_venda text,
  comissionado_codigo text,
  comissionado_nome text,
  pedidos jsonb NOT NULL DEFAULT '[]'::jsonb,
  alertas jsonb NOT NULL DEFAULT '[]'::jsonb,
  recebimento_id uuid REFERENCES public.financeiro_recebimentos(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'PROCESSADO' CHECK (status IN ('PROCESSADO','PENDENTE','PRONTO','CONFIRMADO')),
  criado_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, arquivo_hash)
);

CREATE TABLE public.erp_repasse_importacao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id uuid NOT NULL REFERENCES public.erp_repasse_importacoes(id) ON DELETE RESTRICT,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  linha integer NOT NULL CHECK (linha > 0),
  produto text NOT NULL,
  data_alocacao date NOT NULL,
  periodo text NOT NULL,
  numero_grupo text NOT NULL,
  numero_cota text NOT NULL,
  versao text,
  cliente_nome text NOT NULL,
  parcela_numero integer NOT NULL CHECK (parcela_numero > 0),
  parcela_total integer NOT NULL CHECK (parcela_total > 0),
  situacao text,
  percentual_comissao numeric(9,4) NOT NULL,
  valor_comissao numeric(15,2) NOT NULL CHECK (valor_comissao > 0),
  valor_base numeric(15,2) NOT NULL CHECK (valor_base > 0),
  status_conciliacao text NOT NULL DEFAULT 'NAO_ENCONTRADO'
    CHECK (status_conciliacao IN ('VINCULADO_AUTO','VINCULADO_MANUAL','ATENCAO','NAO_ENCONTRADO','LANCADO_LEGADO')),
  previsao_franquia_id uuid REFERENCES public.comissao_previsoes_franquia(id) ON DELETE RESTRICT,
  previsao_sugerida_id uuid REFERENCES public.comissao_previsoes_franquia(id) ON DELETE SET NULL,
  venda_id uuid REFERENCES public.vendas(id) ON DELETE RESTRICT,
  participante_comercial_id uuid REFERENCES public.participantes_comerciais(id) ON DELETE RESTRICT,
  alertas jsonb NOT NULL DEFAULT '[]'::jsonb,
  dados_origem jsonb NOT NULL DEFAULT '{}'::jsonb,
  vinculado_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  vinculado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (importacao_id, linha)
);

CREATE INDEX erp_repasse_importacoes_empresa_idx ON public.erp_repasse_importacoes(empresa_id, created_at DESC);
CREATE INDEX erp_repasse_itens_importacao_idx ON public.erp_repasse_importacao_itens(importacao_id, status_conciliacao, linha);
CREATE UNIQUE INDEX erp_repasse_item_previsao_unica_idx
  ON public.erp_repasse_importacao_itens(empresa_id, previsao_franquia_id)
  WHERE previsao_franquia_id IS NOT NULL;

ALTER TABLE public.erp_repasse_importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_repasse_importacao_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY erp_repasse_importacoes_read ON public.erp_repasse_importacoes
  FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
CREATE POLICY erp_repasse_itens_read ON public.erp_repasse_importacao_itens
  FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
REVOKE ALL ON TABLE public.erp_repasse_importacoes, public.erp_repasse_importacao_itens FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.erp_repasse_importacoes, public.erp_repasse_importacao_itens TO authenticated;
GRANT ALL ON TABLE public.erp_repasse_importacoes, public.erp_repasse_importacao_itens TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_importar_repasse_racon(
  p_empresa_id uuid,
  p_administradora_id uuid,
  p_competencia text,
  p_arquivo_nome text,
  p_arquivo_path text,
  p_arquivo_hash text,
  p_relatorio jsonb,
  p_data_recebimento date,
  p_conta_entrada text,
  p_conta_bancaria_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_importacao public.erp_repasse_importacoes%ROWTYPE;
  v_item_json jsonb;
  v_item public.erp_repasse_importacao_itens%ROWTYPE;
  v_match record;
  v_exact_count integer;
  v_auto integer := 0;
  v_atencao integer := 0;
  v_nao_encontrado integer := 0;
  v_alertas jsonb;
  v_recebimento_result jsonb;
  v_recebimento_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id, 'gerenciar_financeiro') THEN
    RAISE EXCEPTION 'Sem permissão para importar repasses nesta empresa';
  END IF;
  IF p_competencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Competência inválida'; END IF;
  IF jsonb_typeof(p_relatorio->'itens') <> 'array' OR jsonb_array_length(p_relatorio->'itens') = 0 THEN
    RAISE EXCEPTION 'Relatório sem itens';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.empresa_administradoras ea WHERE ea.empresa_id=p_empresa_id AND ea.administradora_id=p_administradora_id AND ea.status='ATIVA') THEN
    RAISE EXCEPTION 'Administradora não concedida à empresa';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text || ':REPASSE_PDF:' || p_arquivo_hash, 0));
  SELECT * INTO v_importacao FROM public.erp_repasse_importacoes
  WHERE empresa_id=p_empresa_id AND arquivo_hash=p_arquivo_hash;
  IF FOUND THEN
    RETURN jsonb_build_object('importacao_id',v_importacao.id,'idempotente',true,'valor_total',v_importacao.valor_total_bruto);
  END IF;

  INSERT INTO public.erp_repasse_importacoes(
    empresa_id,administradora_id,competencia,arquivo_nome,arquivo_path,arquivo_hash,
    valor_total_bruto,ponto_venda,comissionado_codigo,comissionado_nome,pedidos,alertas,criado_por_usuario_id
  ) VALUES(
    p_empresa_id,p_administradora_id,p_competencia,trim(p_arquivo_nome),p_arquivo_path,p_arquivo_hash,
    (p_relatorio->>'valor_total')::numeric,nullif(p_relatorio->>'ponto_venda',''),
    nullif(p_relatorio->>'comissionado_codigo',''),nullif(p_relatorio->>'comissionado_nome',''),
    coalesce(p_relatorio->'pedidos','[]'::jsonb),coalesce(p_relatorio->'alertas','[]'::jsonb),public.current_usuario_id()
  ) RETURNING * INTO v_importacao;

  FOR v_item_json IN SELECT value FROM jsonb_array_elements(p_relatorio->'itens') LOOP
    INSERT INTO public.erp_repasse_importacao_itens(
      importacao_id,empresa_id,linha,produto,data_alocacao,periodo,numero_grupo,numero_cota,versao,
      cliente_nome,parcela_numero,parcela_total,situacao,percentual_comissao,valor_comissao,valor_base,dados_origem
    ) VALUES(
      v_importacao.id,p_empresa_id,(v_item_json->>'linha')::integer,v_item_json->>'produto',(v_item_json->>'data_alocacao')::date,
      v_item_json->>'periodo',v_item_json->>'grupo',v_item_json->>'cota',v_item_json->>'versao',v_item_json->>'cliente_nome',
      (v_item_json->>'parcela_numero')::integer,(v_item_json->>'parcela_total')::integer,v_item_json->>'situacao',
      (v_item_json->>'percentual_comissao')::numeric,(v_item_json->>'valor_comissao')::numeric,(v_item_json->>'valor_base')::numeric,v_item_json
    ) RETURNING * INTO v_item;

    SELECT count(*) INTO v_exact_count
    FROM public.comissao_previsoes_franquia f
    JOIN public.cotas_definitivas c ON c.id=f.cota_definitiva_id AND c.empresa_id=f.empresa_id
    WHERE f.empresa_id=p_empresa_id AND f.administradora_id=p_administradora_id
      AND f.competencia=p_competencia AND f.status IN ('prevista','parcialmente_liquidada')
      AND ltrim(regexp_replace(c.numero_grupo,'[^0-9]','','g'),'0')=ltrim(v_item.numero_grupo,'0')
      AND ltrim(regexp_replace(coalesce(c.numero_cota,''),'[^0-9]','','g'),'0')=ltrim(v_item.numero_cota,'0')
      AND f.ordem_etapa=v_item.parcela_numero
      AND abs((f.valor_previsto-coalesce(f.valor_liquidado,0))-v_item.valor_comissao)<=0.02
      AND NOT EXISTS (SELECT 1 FROM public.erp_repasse_importacao_itens x WHERE x.empresa_id=p_empresa_id AND x.previsao_franquia_id=f.id);

    IF v_exact_count = 1 THEN
      SELECT f.id,f.venda_id,v.participante_comercial_id,v.cliente_nome INTO v_match
      FROM public.comissao_previsoes_franquia f
      JOIN public.cotas_definitivas c ON c.id=f.cota_definitiva_id AND c.empresa_id=f.empresa_id
      JOIN public.vendas v ON v.id=f.venda_id AND v.empresa_id=f.empresa_id
      WHERE f.empresa_id=p_empresa_id AND f.administradora_id=p_administradora_id AND f.competencia=p_competencia
        AND f.status IN ('prevista','parcialmente_liquidada')
        AND ltrim(regexp_replace(c.numero_grupo,'[^0-9]','','g'),'0')=ltrim(v_item.numero_grupo,'0')
        AND ltrim(regexp_replace(coalesce(c.numero_cota,''),'[^0-9]','','g'),'0')=ltrim(v_item.numero_cota,'0')
        AND f.ordem_etapa=v_item.parcela_numero
        AND abs((f.valor_previsto-coalesce(f.valor_liquidado,0))-v_item.valor_comissao)<=0.02
        AND NOT EXISTS (SELECT 1 FROM public.erp_repasse_importacao_itens x WHERE x.empresa_id=p_empresa_id AND x.previsao_franquia_id=f.id)
      LIMIT 1;
      IF regexp_replace(upper(coalesce(v_match.cliente_nome,'')),'[^A-Z0-9]','','g') = regexp_replace(upper(v_item.cliente_nome),'[^A-Z0-9]','','g') THEN
        UPDATE public.erp_repasse_importacao_itens SET status_conciliacao='VINCULADO_AUTO',previsao_franquia_id=v_match.id,
          previsao_sugerida_id=v_match.id,venda_id=v_match.venda_id,participante_comercial_id=v_match.participante_comercial_id,
          vinculado_em=now(),updated_at=now() WHERE id=v_item.id;
        v_auto:=v_auto+1;
      ELSE
        UPDATE public.erp_repasse_importacao_itens SET status_conciliacao='ATENCAO',previsao_sugerida_id=v_match.id,
          alertas=jsonb_build_array('Nome do cliente diverge do cadastro do sistema') WHERE id=v_item.id;
        v_atencao:=v_atencao+1;
      END IF;
    ELSE
      SELECT f.id,f.venda_id,v.participante_comercial_id INTO v_match
      FROM public.comissao_previsoes_franquia f
      JOIN public.cotas_definitivas c ON c.id=f.cota_definitiva_id AND c.empresa_id=f.empresa_id
      JOIN public.vendas v ON v.id=f.venda_id AND v.empresa_id=f.empresa_id
      WHERE f.empresa_id=p_empresa_id AND f.administradora_id=p_administradora_id AND f.competencia=p_competencia
        AND f.status IN ('prevista','parcialmente_liquidada')
        AND ltrim(regexp_replace(c.numero_grupo,'[^0-9]','','g'),'0')=ltrim(v_item.numero_grupo,'0')
        AND ltrim(regexp_replace(coalesce(c.numero_cota,''),'[^0-9]','','g'),'0')=ltrim(v_item.numero_cota,'0')
      ORDER BY abs(f.ordem_etapa-v_item.parcela_numero),abs((f.valor_previsto-coalesce(f.valor_liquidado,0))-v_item.valor_comissao)
      LIMIT 1;
      IF FOUND THEN
        v_alertas:=jsonb_build_array('Parcela, valor ou duplicidade diverge do sistema; confira antes de vincular');
        UPDATE public.erp_repasse_importacao_itens SET status_conciliacao='ATENCAO',previsao_sugerida_id=v_match.id,alertas=v_alertas WHERE id=v_item.id;
        v_atencao:=v_atencao+1;
      ELSE
        v_nao_encontrado:=v_nao_encontrado+1;
      END IF;
    END IF;
  END LOOP;

  UPDATE public.erp_repasse_importacoes SET status=CASE WHEN v_atencao+v_nao_encontrado=0 THEN 'PRONTO' ELSE 'PENDENTE' END,updated_at=now()
  WHERE id=v_importacao.id;
  v_recebimento_result := public.rpc_registrar_recebimento_manual(
    p_empresa_id,p_administradora_id,p_competencia,v_importacao.valor_total_bruto,p_data_recebimento,
    p_conta_entrada,'repasse-pdf:'||p_arquivo_hash,p_conta_bancaria_id,NULL,NULL,
    'Entrada bruta do repasse Racon '||p_competencia,'Gerado pelo PDF '||trim(p_arquivo_nome)
  );
  v_recebimento_id := (v_recebimento_result#>>'{recebimento,id}')::uuid;
  UPDATE public.erp_repasse_importacoes SET recebimento_id=v_recebimento_id WHERE id=v_importacao.id;
  RETURN jsonb_build_object('importacao_id',v_importacao.id,'idempotente',false,'valor_total',v_importacao.valor_total_bruto,
    'recebimento_id',v_recebimento_id,'vinculados_auto',v_auto,'atencao',v_atencao,'nao_encontrados',v_nao_encontrado);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_vincular_item_repasse_manual(
  p_empresa_id uuid,p_item_id uuid,p_previsao_franquia_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_item public.erp_repasse_importacao_itens%ROWTYPE; v_prev public.comissao_previsoes_franquia%ROWTYPE; v_venda public.vendas%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id,'gerenciar_financeiro') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO v_item FROM public.erp_repasse_importacao_itens WHERE id=p_item_id AND empresa_id=p_empresa_id FOR UPDATE;
  SELECT * INTO v_prev FROM public.comissao_previsoes_franquia WHERE id=p_previsao_franquia_id AND empresa_id=p_empresa_id;
  IF v_item.id IS NULL OR v_prev.id IS NULL THEN RAISE EXCEPTION 'Item ou previsão não encontrado no tenant'; END IF;
  IF EXISTS (SELECT 1 FROM public.erp_repasse_importacao_itens x WHERE x.empresa_id=p_empresa_id AND x.previsao_franquia_id=v_prev.id AND x.id<>v_item.id) THEN
    RAISE EXCEPTION 'Esta previsão já está vinculada a outra linha';
  END IF;
  SELECT * INTO v_venda FROM public.vendas WHERE id=v_prev.venda_id AND empresa_id=p_empresa_id;
  UPDATE public.erp_repasse_importacao_itens SET status_conciliacao='VINCULADO_MANUAL',previsao_franquia_id=v_prev.id,
    previsao_sugerida_id=v_prev.id,venda_id=v_prev.venda_id,participante_comercial_id=v_venda.participante_comercial_id,
    vinculado_por_usuario_id=public.current_usuario_id(),vinculado_em=now(),updated_at=now() WHERE id=v_item.id;
  RETURN jsonb_build_object('ok',true,'item_id',v_item.id,'previsao_id',v_prev.id);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_confirmar_conciliacao_repasse(
  p_empresa_id uuid,p_importacao_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  v_importacao public.erp_repasse_importacoes%ROWTYPE;
  v_venda_id uuid;
  v_programa_atual uuid;
  v_programa_previsao uuid;
  v_item record;
  v_match record;
  v_count integer;
  v_itens jsonb := '[]'::jsonb;
  v_classificacoes jsonb := '[]'::jsonb;
  v_alocar numeric;
  v_diferenca numeric;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id,'gerenciar_financeiro') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO v_importacao FROM public.erp_repasse_importacoes
  WHERE id=p_importacao_id AND empresa_id=p_empresa_id FOR UPDATE;
  IF v_importacao.id IS NULL OR v_importacao.recebimento_id IS NULL THEN RAISE EXCEPTION 'Importação/entrada não encontrada'; END IF;
  IF v_importacao.status='CONFIRMADO' THEN RETURN jsonb_build_object('confirmado',true,'idempotente',true); END IF;
  IF EXISTS (SELECT 1 FROM public.erp_repasse_importacao_itens i WHERE i.importacao_id=p_importacao_id AND i.status_conciliacao IN ('ATENCAO','NAO_ENCONTRADO')) THEN
    RETURN jsonb_build_object('confirmado',false,'motivo','Resolva todas as linhas com atenção antes de confirmar');
  END IF;

  -- Se o perfil/regra mudou, recompõe primeiro todas as previsões ainda não pagas da venda.
  FOR v_venda_id IN SELECT DISTINCT i.venda_id FROM public.erp_repasse_importacao_itens i
    WHERE i.importacao_id=p_importacao_id AND i.venda_id IS NOT NULL AND i.status_conciliacao<>'LANCADO_LEGADO' LOOP
    v_programa_atual:=NULL;
    v_programa_previsao:=NULL;
    SELECT rp.programa_id INTO v_programa_atual
    FROM public.vendas v
    JOIN public.comissao_regras_participantes rp ON rp.empresa_id=v.empresa_id AND rp.perfil_id=v.perfil_principal_id
      AND rp.ativa AND rp.configuracao_homologada AND rp.status='HOMOLOGADA'
      AND rp.vigencia_inicio<=v.data_venda::date AND (rp.vigencia_fim IS NULL OR rp.vigencia_fim>=v.data_venda::date)
    WHERE v.id=v_venda_id AND v.empresa_id=p_empresa_id ORDER BY rp.versao DESC LIMIT 1;
    SELECT rf.programa_id INTO v_programa_previsao
    FROM public.erp_repasse_importacao_itens i
    JOIN public.comissao_previsoes_franquia f ON f.id=i.previsao_franquia_id
    LEFT JOIN public.comissao_regras_franquia rf ON rf.id=f.regra_franquia_id
    WHERE i.importacao_id=p_importacao_id AND i.venda_id=v_venda_id LIMIT 1;

    IF v_programa_atual IS DISTINCT FROM v_programa_previsao THEN
      IF v_programa_atual IS NULL THEN RAISE EXCEPTION 'Venda % sem regra atual homologada',v_venda_id; END IF;
      IF EXISTS (SELECT 1 FROM public.comissao_previsoes_participantes p WHERE p.empresa_id=p_empresa_id AND p.venda_id=v_venda_id AND (coalesce(p.valor_elegivel,0)>0 OR coalesce(p.valor_pago,0)>0)) THEN
        RAISE EXCEPTION 'Venda % já possui comissão elegível/paga e não pode ser reorganizada',v_venda_id;
      END IF;
      UPDATE public.erp_repasse_importacao_itens SET previsao_franquia_id=NULL,previsao_sugerida_id=NULL,updated_at=now()
      WHERE importacao_id=p_importacao_id AND venda_id=v_venda_id;
      PERFORM public.rpc_gerar_previsoes_comissao_v2_antes_171(p_empresa_id,v_venda_id,'repasse_regra_atual:'||p_importacao_id::text||':'||v_venda_id::text);
      PERFORM public.comissao_gerar_previsoes_perfis_171(p_empresa_id,v_venda_id);

      FOR v_item IN SELECT * FROM public.erp_repasse_importacao_itens WHERE importacao_id=p_importacao_id AND venda_id=v_venda_id LOOP
        SELECT count(*) INTO v_count FROM public.comissao_previsoes_franquia f
        JOIN public.cotas_definitivas c ON c.id=f.cota_definitiva_id
        WHERE f.empresa_id=p_empresa_id AND f.venda_id=v_venda_id AND f.competencia=v_importacao.competencia
          AND f.ordem_etapa=v_item.parcela_numero
          AND ltrim(regexp_replace(c.numero_grupo,'[^0-9]','','g'),'0')=ltrim(v_item.numero_grupo,'0')
          AND ltrim(regexp_replace(coalesce(c.numero_cota,''),'[^0-9]','','g'),'0')=ltrim(v_item.numero_cota,'0')
          AND abs((f.valor_previsto-coalesce(f.valor_liquidado,0))-v_item.valor_comissao)<=0.02;
        IF v_count=1 THEN
          SELECT f.id,f.venda_id,v.participante_comercial_id INTO v_match FROM public.comissao_previsoes_franquia f
          JOIN public.cotas_definitivas c ON c.id=f.cota_definitiva_id JOIN public.vendas v ON v.id=f.venda_id
          WHERE f.empresa_id=p_empresa_id AND f.venda_id=v_venda_id AND f.competencia=v_importacao.competencia
            AND f.ordem_etapa=v_item.parcela_numero
            AND ltrim(regexp_replace(c.numero_grupo,'[^0-9]','','g'),'0')=ltrim(v_item.numero_grupo,'0')
            AND ltrim(regexp_replace(coalesce(c.numero_cota,''),'[^0-9]','','g'),'0')=ltrim(v_item.numero_cota,'0')
            AND abs((f.valor_previsto-coalesce(f.valor_liquidado,0))-v_item.valor_comissao)<=0.02 LIMIT 1;
          UPDATE public.erp_repasse_importacao_itens SET previsao_franquia_id=v_match.id,previsao_sugerida_id=v_match.id,
            participante_comercial_id=v_match.participante_comercial_id,status_conciliacao='VINCULADO_AUTO',
            alertas=alertas||'[''Cronograma reorganizado pela regra vigente antes do recebimento'']'::jsonb,updated_at=now() WHERE id=v_item.id;
        ELSE
          UPDATE public.erp_repasse_importacao_itens SET status_conciliacao='ATENCAO',
            alertas=alertas||'[''A regra vigente alterou o valor ou a parcela; confira o novo cronograma'']'::jsonb,updated_at=now() WHERE id=v_item.id;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM public.erp_repasse_importacao_itens i WHERE i.importacao_id=p_importacao_id AND i.status_conciliacao='ATENCAO') THEN
    UPDATE public.erp_repasse_importacoes SET status='PENDENTE',updated_at=now() WHERE id=p_importacao_id;
    RETURN jsonb_build_object('confirmado',false,'reorganizado',true,'motivo','A regra mudou e o novo cronograma divergiu do PDF; confira as linhas destacadas');
  END IF;

  FOR v_item IN SELECT i.*,f.valor_previsto,f.valor_liquidado FROM public.erp_repasse_importacao_itens i
    JOIN public.comissao_previsoes_franquia f ON f.id=i.previsao_franquia_id WHERE i.importacao_id=p_importacao_id LOOP
    v_alocar:=least(v_item.valor_comissao,v_item.valor_previsto-coalesce(v_item.valor_liquidado,0));
    IF v_alocar>0 THEN v_itens:=v_itens||jsonb_build_array(jsonb_build_object('previsao_franquia_id',v_item.previsao_franquia_id,'valor',v_alocar)); END IF;
    v_diferenca:=v_item.valor_comissao-v_alocar;
    IF v_diferenca>0 THEN v_classificacoes:=v_classificacoes||jsonb_build_array(jsonb_build_object('tipo','OUTROS','valor',v_diferenca,'descricao','Diferença autorizada na conciliação do PDF, linha '||v_item.linha)); END IF;
  END LOOP;
  v_result:=public.rpc_conciliar_recebimento_manual(p_empresa_id,v_importacao.recebimento_id,v_itens,v_classificacoes,'repasse-confirmar:'||p_importacao_id::text);
  UPDATE public.erp_repasse_importacoes SET status='CONFIRMADO',updated_at=now() WHERE id=p_importacao_id;
  RETURN jsonb_build_object('confirmado',true,'idempotente',false,'conciliacao',v_result);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_lancar_item_repasse_legado(
  p_empresa_id uuid,p_item_id uuid,p_participante_id uuid,p_regra_participante_id uuid,
  p_valor_comissao_manual numeric DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  v_item public.erp_repasse_importacao_itens%ROWTYPE;
  v_importacao public.erp_repasse_importacoes%ROWTYPE;
  v_regra public.comissao_regras_participantes%ROWTYPE;
  v_lote_result jsonb;
  v_legado public.importacao_clientes_legado_itens%ROWTYPE;
  v_previsao_id uuid;
  v_imposto numeric:=0;
  v_bruto_participante numeric;
  v_imposto_participante numeric;
  v_liquido_participante numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id,'gerenciar_financeiro') OR NOT public.has_company_permission(p_empresa_id,'gerenciar_comissoes') THEN
    RAISE EXCEPTION 'Sem permissão para lançar comissão legada';
  END IF;
  SELECT * INTO v_item FROM public.erp_repasse_importacao_itens WHERE id=p_item_id AND empresa_id=p_empresa_id FOR UPDATE;
  SELECT * INTO v_importacao FROM public.erp_repasse_importacoes WHERE id=v_item.importacao_id AND empresa_id=p_empresa_id;
  IF v_item.id IS NULL OR v_item.status_conciliacao NOT IN ('NAO_ENCONTRADO','ATENCAO') THEN RAISE EXCEPTION 'Linha não está disponível para lançamento legado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.participantes_comerciais p WHERE p.id=p_participante_id AND p.empresa_id=p_empresa_id AND p.status='ATIVO') THEN RAISE EXCEPTION 'Consultor inválido'; END IF;
  SELECT * INTO v_regra FROM public.comissao_regras_participantes r
  WHERE r.id=p_regra_participante_id AND r.empresa_id=p_empresa_id AND r.ativa AND r.configuracao_homologada AND r.status='HOMOLOGADA';
  IF v_regra.id IS NULL THEN RAISE EXCEPTION 'Regra do consultor inválida'; END IF;

  v_lote_result:=public.rpc_importar_clientes_legado_racon(
    p_empresa_id,'Repasse PDF - '||v_importacao.arquivo_nome,md5(v_importacao.arquivo_hash||':'||v_item.id::text),
    'repasse-legado:'||v_item.id::text,jsonb_build_array(jsonb_build_object(
      'linha',2,'cliente_nome',v_item.cliente_nome,'cpf_cnpj','','telefone','',
      'bem',v_item.produto,'data_contrato',v_item.data_alocacao,'grupo',v_item.numero_grupo,
      'cota',v_item.numero_cota,'valor_credito',v_item.valor_base
    )),NULL,p_participante_id,true,v_item.data_alocacao
  );
  SELECT * INTO v_legado FROM public.importacao_clientes_legado_itens
  WHERE lote_id=(v_lote_result->>'lote_id')::uuid LIMIT 1;
  IF v_legado.id IS NULL THEN RAISE EXCEPTION 'Cota administrativa legada não foi criada'; END IF;
  UPDATE public.vendas SET perfil_principal_id=v_regra.perfil_id,updated_at=now() WHERE id=v_legado.venda_id AND empresa_id=p_empresa_id;

  SELECT coalesce(f.percentual_imposto,0) INTO v_imposto FROM public.empresa_configuracoes_fiscais f
  WHERE f.empresa_id=p_empresa_id AND f.ativo AND f.vigencia_inicio<=current_date
    AND (f.vigencia_fim IS NULL OR f.vigencia_fim>=current_date) ORDER BY f.vigencia_inicio DESC LIMIT 1;
  v_imposto:=coalesce(v_imposto,0);
  v_bruto_participante:=coalesce(p_valor_comissao_manual,round(v_item.valor_comissao*v_regra.percentual_comissao/100,2));
  IF v_bruto_participante<=0 THEN RAISE EXCEPTION 'Valor manual da comissão inválido'; END IF;
  v_imposto_participante:=CASE WHEN v_regra.aplicar_desconto_impostos THEN round(v_bruto_participante*v_imposto/100,2) ELSE 0 END;
  v_liquido_participante:=v_bruto_participante-v_imposto_participante;

  INSERT INTO public.comissao_previsoes_franquia(
    empresa_id,venda_id,cota_definitiva_id,administradora_id,ordem_etapa,nome_etapa,competencia,
    base_calculo_valor,percentual_aplicado,valor_previsto,status,snapshot_regra,tipo_gatilho
  ) VALUES(
    p_empresa_id,v_legado.venda_id,v_legado.cota_definitiva_id,v_importacao.administradora_id,v_item.parcela_numero,
    v_item.parcela_numero||'ª Parcela (PDF legado)',v_importacao.competencia,v_item.valor_base,v_item.percentual_comissao,
    v_item.valor_comissao,'prevista',jsonb_build_object('origem','REPASSE_PDF_LEGADO','item_repasse_id',v_item.id,
      'valor_bruto',v_item.valor_comissao,'imposto_aliquota',v_imposto,'imposto_valor',round(v_item.valor_comissao*v_imposto/100,2),
      'valor_liquido',v_item.valor_comissao-round(v_item.valor_comissao*v_imposto/100,2)),'MES_RELATIVO'
  ) RETURNING id INTO v_previsao_id;

  INSERT INTO public.comissao_previsoes_participantes(
    empresa_id,venda_id,cota_definitiva_id,participante_comercial_id,regra_participante_id,papel_tipo,
    previsao_franquia_id,ordem_etapa,nome_etapa,competencia,base_calculo_valor,percentual_aplicado,
    valor_previsto,status,snapshot_regra,tipo_gatilho,origem_registro
  ) VALUES(
    p_empresa_id,v_legado.venda_id,v_legado.cota_definitiva_id,p_participante_id,v_regra.id,'CONSULTOR',v_previsao_id,
    v_item.parcela_numero,v_item.parcela_numero||'ª Parcela (PDF legado)',v_importacao.competencia,v_item.valor_comissao,
    v_regra.percentual_comissao,v_liquido_participante,'prevista',jsonb_build_object('origem','IMPORTACAO_LEGADO',
      'item_repasse_id',v_item.id,'valor_bruto',v_bruto_participante,'imposto_aliquota',v_imposto,
      'imposto_valor',v_imposto_participante,'valor_liquido',v_liquido_participante),'MES_RELATIVO','IMPORTACAO_LEGADO'
  );
  UPDATE public.erp_repasse_importacao_itens SET status_conciliacao='LANCADO_LEGADO',previsao_franquia_id=v_previsao_id,
    previsao_sugerida_id=v_previsao_id,venda_id=v_legado.venda_id,participante_comercial_id=p_participante_id,
    vinculado_por_usuario_id=public.current_usuario_id(),vinculado_em=now(),updated_at=now() WHERE id=v_item.id;
  RETURN jsonb_build_object('ok',true,'venda_id',v_legado.venda_id,'cota_id',v_legado.cota_definitiva_id,'previsao_id',v_previsao_id);
END $$;

REVOKE ALL ON FUNCTION public.rpc_importar_repasse_racon(uuid,uuid,text,text,text,text,jsonb,date,text,uuid) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.rpc_vincular_item_repasse_manual(uuid,uuid,uuid) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.rpc_confirmar_conciliacao_repasse(uuid,uuid) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.rpc_lancar_item_repasse_legado(uuid,uuid,uuid,uuid,numeric) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_importar_repasse_racon(uuid,uuid,text,text,text,text,jsonb,date,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_vincular_item_repasse_manual(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_confirmar_conciliacao_repasse(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lancar_item_repasse_legado(uuid,uuid,uuid,uuid,numeric) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
