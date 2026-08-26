-- 104 — Correção robusta da RPC rpc_converter_contratacao_venda e consolidação de governança dos grupos
BEGIN;

-- Prazo comercial é o saldo do grupo na data da venda, nunca o prazo original
-- repetido no produto. A mesma regra é reutilizada pelo snapshot transacional.
CREATE OR REPLACE FUNCTION public.calcular_prazo_restante_grupo(
  p_grupo_id uuid,
  p_data_referencia date DEFAULT CURRENT_DATE
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_grupo public.grupos_consorcio%ROWTYPE;
  v_meses integer := 0;
  v_realizadas integer;
BEGIN
  SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id = p_grupo_id;
  IF NOT FOUND OR v_grupo.prazo_total IS NULL OR v_grupo.prazo_total <= 0 THEN
    RETURN NULL;
  END IF;
  IF COALESCE(v_grupo.atualizacao_parcelas_automatica, false)
     AND v_grupo.data_base_parcelas IS NOT NULL
     AND v_grupo.parcelas_realizadas_base IS NOT NULL THEN
    v_meses := GREATEST(
      0,
      (extract(year FROM age(p_data_referencia, v_grupo.data_base_parcelas))::integer * 12)
      + extract(month FROM age(p_data_referencia, v_grupo.data_base_parcelas))::integer
    );
    v_realizadas := LEAST(
      v_grupo.prazo_total,
      GREATEST(0, v_grupo.parcelas_realizadas_base + v_meses)
    );
    RETURN GREATEST(v_grupo.prazo_total - v_realizadas, 0);
  END IF;
  RETURN GREATEST(
    COALESCE(
      v_grupo.prazo_restante,
      v_grupo.prazo_total - COALESCE(v_grupo.parcelas_realizadas, 0)
    ),
    0
  );
END;
$$;
REVOKE ALL ON FUNCTION public.calcular_prazo_restante_grupo(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_prazo_restante_grupo(uuid,date) TO authenticated, service_role;

-- 1. Consolidar grupos sem governança explícita como GLOBAL
UPDATE public.grupos_consorcio
SET origem_governanca = 'GLOBAL'
WHERE origem_governanca IS NULL;

-- 2. Atualizar rpc_preparar_formalizacao_contratacao com resolução tolerante
CREATE OR REPLACE FUNCTION public.rpc_preparar_formalizacao_contratacao(
  p_empresa_id uuid,
  p_contratacao_id uuid,
  p_grupo_id uuid,
  p_opcao_cota_id uuid,
  p_participante_principal_id uuid,
  p_participante_secundario_id uuid DEFAULT NULL,
  p_fracao_secundario numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_contratacao public.contratacoes_online%ROWTYPE;
  v_grupo public.grupos_consorcio%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;

  SELECT * INTO v_contratacao FROM public.contratacoes_online
  WHERE id = p_contratacao_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contratação não encontrada no tenant'; END IF;

  IF NOT COALESCE(v_contratacao.contrato_assinado, false) THEN
    RAISE EXCEPTION 'Contrato ainda não foi assinado';
  END IF;

  IF EXISTS (SELECT 1 FROM public.vendas WHERE empresa_id = p_empresa_id AND contratacao_id = p_contratacao_id) THEN
    RAISE EXCEPTION 'Venda já existente para esta contratação';
  END IF;

  SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id = p_grupo_id AND ativo IS TRUE;
  IF NOT FOUND OR v_grupo.administradora_id IS NULL THEN RAISE EXCEPTION 'Grupo não configurado'; END IF;
  IF NOT public.grupo_concedido_para_empresa(p_empresa_id, p_grupo_id) THEN
    RAISE EXCEPTION 'Grupo não concedido para a empresa';
  END IF;

  IF p_opcao_cota_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.grupos_cotas
    WHERE id = p_opcao_cota_id AND grupo_id = p_grupo_id
      AND ativo IS TRUE AND status NOT IN ('Inativo', 'Esgotado')
  ) THEN
    RAISE EXCEPTION 'UUID do produto/cota é obrigatório e deve pertencer ao grupo';
  END IF;

  UPDATE public.contratacoes_online SET
    grupo_id = p_grupo_id,
    cota_id = p_opcao_cota_id::text,
    participante_comercial_id = p_participante_principal_id,
    participante_secundario_id = p_participante_secundario_id,
    participante_secundario_fracao_percentual = CASE WHEN p_participante_secundario_id IS NULL THEN NULL ELSE p_fracao_secundario END,
    status_operacional_erp = 'PRONTO_FORMALIZAR',
    pendencia_codigo = NULL,
    pendencia_descricao = NULL,
    em_conferencia_em = COALESCE(em_conferencia_em, now()),
    updated_at = now()
  WHERE id = p_contratacao_id AND empresa_id = p_empresa_id;

  INSERT INTO public.contratacoes_formalizacao_historico (
    empresa_id, contratacao_id, evento, descricao, dados
  ) VALUES (
    p_empresa_id, p_contratacao_id, 'DADOS_COMERCIAIS_AJUSTADOS',
    'Dados comerciais confirmados para formalização.',
    jsonb_build_object('grupo_id', p_grupo_id, 'cota_id', p_opcao_cota_id, 'principal_id', p_participante_principal_id)
  );

  RETURN jsonb_build_object('ok', true, 'contratacao_id', p_contratacao_id);
END;
$$;

-- 3. Atualizar rpc_converter_contratacao_venda (com criação/vinculação automática de cliente)
CREATE OR REPLACE FUNCTION public.rpc_converter_contratacao_venda(
  p_empresa_id uuid,
  p_contratacao_id uuid,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_contratacao public.contratacoes_online%ROWTYPE;
  v_grupo public.grupos_consorcio%ROWTYPE;
  v_opcao public.grupos_cotas%ROWTYPE;
  v_venda public.vendas%ROWTYPE;
  v_cota public.cotas_definitivas%ROWTYPE;
  v_idem record;
  v_hash text;
  v_dados jsonb;
  v_opcao_text text;
  v_opcao_id uuid;
  v_modalidade_id uuid;
  v_valor_modalidade record;
  v_credito numeric(15,2);
  v_parcela numeric(15,2);
  v_prazo integer;
  v_snapshot jsonb;
  v_previsoes jsonb;
  v_response jsonb;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'Idempotency key obrigatória';
  END IF;

  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id, 'formalizar_vendas') THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;

  v_hash := md5(p_contratacao_id::text);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text || ':CONVERSAO_VENDA:' || p_idempotency_key, 0));

  -- 1. Idempotência por chave
  SELECT * INTO v_idem FROM public.operacoes_idempotentes
  WHERE empresa_id = p_empresa_id AND operacao = 'CONVERSAO_VENDA' AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_idem.payload_hash <> v_hash THEN
      RAISE EXCEPTION 'Idempotency key reutilizada com payload diferente';
    END IF;
    RETURN v_idem.resposta;
  END IF;

  -- 2. Busca e trava a contratação
  SELECT * INTO v_contratacao FROM public.contratacoes_online WHERE id = p_contratacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contratação não encontrada';
  END IF;

  IF v_contratacao.empresa_id IS NULL OR v_contratacao.empresa_id <> p_empresa_id THEN
    RAISE EXCEPTION 'Contratação pertence a outro tenant';
  END IF;

  -- 3. Se a contratação já virou venda, retorna a venda e cota existentes
  SELECT * INTO v_venda FROM public.vendas WHERE empresa_id = p_empresa_id AND contratacao_id = p_contratacao_id;
  IF FOUND THEN
    SELECT * INTO v_cota FROM public.cotas_definitivas WHERE venda_id = v_venda.id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Venda existente sem cota definitiva íntegra';
    END IF;
    SELECT public.rpc_gerar_previsoes_comissao(p_empresa_id, v_venda.id, p_idempotency_key || ':comissao') INTO v_previsoes;
    v_response := jsonb_build_object('venda', to_jsonb(v_venda), 'cotaDefinitiva', to_jsonb(v_cota), 'previsoes', v_previsoes, 'reused', true);
    INSERT INTO public.operacoes_idempotentes(empresa_id, operacao, idempotency_key, payload_hash, recurso_id, resposta)
    VALUES (p_empresa_id, 'CONVERSAO_VENDA', p_idempotency_key, v_hash, v_venda.id, v_response);
    RETURN v_response;
  END IF;

  v_dados := COALESCE(v_contratacao.dados_simulacao, '{}'::jsonb);

  -- 4. Grupo canônico deve ter sido confirmado explicitamente na formalização.
  IF v_contratacao.grupo_id IS NOT NULL THEN
    SELECT * INTO v_grupo
    FROM public.grupos_consorcio
    WHERE id = v_contratacao.grupo_id AND ativo IS TRUE;
  END IF;

  IF v_grupo.id IS NULL OR v_grupo.administradora_id IS NULL THEN
    RAISE EXCEPTION 'Grupo/administradora inválidos na contratação';
  END IF;

  -- 5. Validar concessão ativa da Administradora para a Empresa
  IF NOT EXISTS (
    SELECT 1 FROM public.empresa_administradoras ea
    JOIN public.administradoras a ON a.id = ea.administradora_id
    WHERE ea.empresa_id = p_empresa_id AND ea.administradora_id = v_grupo.administradora_id AND ea.status = 'ATIVA' AND a.status = 'ATIVA'
  ) THEN
    RAISE EXCEPTION 'Empresa sem concessão ativa para a administradora do grupo';
  END IF;

  -- 6. Valores financeiros da contratação
  v_credito := COALESCE(
    v_contratacao.credito_selecionado,
    NULLIF(v_dados->>'valor_credito', '')::numeric,
    NULLIF(v_dados->>'somaCotas', '')::numeric,
    NULLIF(v_dados#>>'{selecoes,0,credito}', '')::numeric
  );

  v_parcela := COALESCE(
    v_contratacao.parcela_estimada,
    NULLIF(v_dados->>'valor_parcela', '')::numeric,
    NULLIF(v_dados->>'primeiraParcela', '')::numeric,
    NULLIF(v_dados#>>'{totais,primeiraParcela}', '')::numeric
  );

  v_prazo := COALESCE(
    v_contratacao.prazo,
    NULLIF(v_dados->>'prazo', '')::integer,
    v_grupo.prazo_total
  );

  -- 7. Resolução Canônica do Produto/Cota (grupos_cotas)
  v_opcao_text := NULLIF(COALESCE(v_contratacao.cota_id, v_dados->>'cotaId', v_dados->>'opcao_cota_id', v_dados#>>'{selecoes,0,cotaId}'), '');
  IF v_opcao_text IS NOT NULL AND v_opcao_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_opcao_id := v_opcao_text::uuid;
    SELECT * INTO v_opcao FROM public.grupos_cotas
    WHERE id = v_opcao_id AND grupo_id = v_grupo.id
      AND (ativo IS TRUE OR ativo IS NULL)
      AND (status IS NULL OR (status NOT ILIKE 'inativo' AND status NOT ILIKE 'esgotado'));
  END IF;

  v_opcao_id := v_opcao.id;
  IF v_opcao_id IS NULL THEN
    RAISE EXCEPTION 'Opção de cota não encontrada para o grupo ou indisponível';
  END IF;

  v_credito := v_opcao.valor_credito;
  v_prazo := public.calcular_prazo_restante_grupo(v_grupo.id, CURRENT_DATE);
  IF v_prazo IS NULL OR v_prazo <= 0 THEN
    RAISE EXCEPTION 'Grupo sem parcelas restantes para nova venda';
  END IF;

  -- 8. Modalidade e valor devem ser UUIDs canônicos explicitamente escolhidos.
  v_opcao_text := NULLIF(v_dados->>'modalidade_comissao_id', '');
  IF v_opcao_text IS NULL OR v_opcao_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Modalidade canônica obrigatória para formalizar a venda';
  END IF;
  v_modalidade_id := v_opcao_text::uuid;

  SELECT mv.* INTO v_valor_modalidade
  FROM public.grupo_cota_modalidade_valores mv
  JOIN public.grupos_modalidades_disponiveis gm
    ON gm.grupo_id = v_grupo.id
   AND gm.administradora_modalidade_id = mv.administradora_modalidade_id
   AND gm.ativo IS TRUE
  JOIN public.administradora_modalidades_comissao m
    ON m.id = mv.administradora_modalidade_id
   AND m.administradora_id = v_grupo.administradora_id
   AND m.ativo IS TRUE
  WHERE mv.grupo_cota_id = v_opcao_id
    AND mv.administradora_modalidade_id = v_modalidade_id
    AND mv.ativo IS TRUE;
  IF v_valor_modalidade.id IS NULL THEN
    RAISE EXCEPTION 'Produto sem valor homologado para a modalidade escolhida';
  END IF;
  v_parcela := v_valor_modalidade.valor_parcela;

  -- Crédito, prazo e parcela vêm exclusivamente do catálogo homologado. Não aceite
  -- valores estimados/JSON da contratação como fonte final da venda.
  IF v_credito IS NULL OR v_credito <= 0 OR v_parcela IS NULL OR v_parcela <= 0 OR v_prazo IS NULL OR v_prazo <= 0 THEN
    RAISE EXCEPTION 'Dados monetários/prazo inválidos no catálogo homologado';
  END IF;

  -- 9. Auto-resolução ou Criação do Cliente no ERP
  IF v_contratacao.cliente_id IS NULL THEN
    IF v_contratacao.cpf IS NOT NULL OR v_contratacao.cnpj IS NOT NULL THEN
      SELECT id INTO v_contratacao.cliente_id FROM public.clientes
      WHERE empresa_id = p_empresa_id AND documento_normalizado = regexp_replace(COALESCE(v_contratacao.cpf, v_contratacao.cnpj), '\D', '', 'g')
      LIMIT 1;
    END IF;

    IF v_contratacao.cliente_id IS NULL THEN
      INSERT INTO public.clientes (
        empresa_id, tipo_pessoa, nome, cpf_cnpj, documento_normalizado, email, telefone,
        cep, endereco, numero, complemento, bairro, cidade, uf,
        participante_comercial_id, origem, status, criado_por_contratacao_id
      ) VALUES (
        p_empresa_id,
        COALESCE(v_contratacao.tipo_pessoa, 'PF'),
        COALESCE(NULLIF(trim(v_contratacao.nome), ''), 'Cliente Consórcio'),
        COALESCE(v_contratacao.cpf, v_contratacao.cnpj),
        regexp_replace(COALESCE(v_contratacao.cpf, v_contratacao.cnpj, ''), '\D', '', 'g'),
        v_contratacao.email, v_contratacao.telefone,
        v_contratacao.cep, v_contratacao.endereco, v_contratacao.numero, v_contratacao.complemento,
        v_contratacao.bairro, v_contratacao.cidade, v_contratacao.uf,
        v_contratacao.participante_comercial_id, 'contratacao_assinada', 'ativo', p_contratacao_id
      ) RETURNING id INTO v_contratacao.cliente_id;
    END IF;
  END IF;

  -- 10. Montagem do Snapshot Imutável
  v_snapshot := jsonb_build_object(
    'dados_simulacao', v_dados,
    'grupo_id', v_grupo.id,
    'grupo_codigo', v_grupo.codigo_grupo,
    'administradora_id', v_grupo.administradora_id,
    'opcao_cota_id', v_opcao_id,
    'modalidade_comissao_id', v_modalidade_id,
    'tipo_administradora_id', v_grupo.tipo_administradora_id,
    'tipo_bem', COALESCE(v_contratacao.tipo_bem, v_dados->>'tipoBem', 'Consórcio'),
    'modalidade', COALESCE(v_dados->>'modalidade', v_dados->>'plano', 'Integral'),
     'valor_credito', v_credito,
     'valor_parcela', v_parcela,
     'prazo_original_grupo', v_grupo.prazo_total,
     'parcelas_restantes_venda', v_prazo,
     'prazo_referencia_em', CURRENT_DATE,
     'prazo', v_prazo,
    'data_conversao', now()
  );

  -- 11. Inserir em Vendas
  INSERT INTO public.vendas (
    empresa_id, cliente_id, lead_id, contratacao_id, cliente_nome, cliente_cpf_cnpj, cliente_email, cliente_telefone,
    administradora_id, grupo_id, opcao_cota_id, modalidade_comissao_id, participante_comercial_id, organizacao_parceira_id,
    valor_credito, prazo, parcela, status, snapshot_venda
  ) VALUES (
    p_empresa_id, v_contratacao.cliente_id, v_contratacao.lead_id, p_contratacao_id,
    COALESCE(NULLIF(trim(v_contratacao.nome), ''), 'Cliente Consórcio'),
    COALESCE(v_contratacao.cpf, v_contratacao.cnpj),
    v_contratacao.email, v_contratacao.telefone,
    v_grupo.administradora_id, v_grupo.id, v_opcao_id, v_modalidade_id,
    v_contratacao.participante_comercial_id, v_contratacao.organizacao_parceira_id,
    v_credito, v_prazo, v_parcela, 'confirmada', v_snapshot
  ) RETURNING * INTO v_venda;

  -- 12. Inserir em Cotas Definitivas
  INSERT INTO public.cotas_definitivas (
    empresa_id, venda_id, administradora_id, grupo_id, numero_grupo, numero_cota, valor_credito, prazo, parcela,
    status, participante_comercial_id, organizacao_parceira_id, snapshot_cota
  ) VALUES (
    p_empresa_id, v_venda.id, v_grupo.administradora_id, v_grupo.id, v_grupo.codigo_grupo,
    NULLIF(v_dados->>'numero_cota', ''),
    v_credito, v_prazo, v_parcela, 'ativa',
    v_contratacao.participante_comercial_id, v_contratacao.organizacao_parceira_id, v_snapshot
  ) RETURNING * INTO v_cota;

  -- 13. Sincronizar contratação e lead
  UPDATE public.contratacoes_online
  SET
    status = 'finalizada',
    cliente_id = v_contratacao.cliente_id,
    grupo_id = v_grupo.id,
    cota_id = v_opcao_id::text,
    status_operacional_erp = 'FORMALIZADA',
    formalizado_em = COALESCE(formalizado_em, now()),
    finalizado_em = COALESCE(finalizado_em, now()),
    updated_at = now()
  WHERE id = p_contratacao_id AND empresa_id = p_empresa_id;

  IF v_contratacao.lead_id IS NOT NULL THEN
    UPDATE public.leads SET status = 'convertido', updated_at = now()
    WHERE id = v_contratacao.lead_id AND empresa_id = p_empresa_id;
  END IF;

  -- 14. Previsões de Comissão e Resposta
  SELECT public.rpc_gerar_previsoes_comissao(p_empresa_id, v_venda.id, p_idempotency_key || ':comissao') INTO v_previsoes;
  v_response := jsonb_build_object('venda', to_jsonb(v_venda), 'cotaDefinitiva', to_jsonb(v_cota), 'previsoes', v_previsoes, 'reused', false);

  INSERT INTO public.operacoes_idempotentes(empresa_id, operacao, idempotency_key, payload_hash, recurso_id, resposta)
  VALUES (p_empresa_id, 'CONVERSAO_VENDA', p_idempotency_key, v_hash, v_venda.id, v_response);

  RETURN v_response;
END;
$$;

COMMIT;
