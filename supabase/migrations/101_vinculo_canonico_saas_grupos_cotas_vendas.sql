-- 101 — Vínculo Canônico Platform/SaaS -> Site -> Contratação -> ERP -> Venda/Cota
-- Forward-only: Harmoniza a resolução de grupos_consorcio e grupos_cotas na conversão
-- transacional de contratações em vendas e cotas definitivas, eliminando falhas de
-- correspondência de IDs legados e garantindo idempotência total.

BEGIN;

-- 1. Atualizar a RPC de conversão transacional com resolução canônica resiliente
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

  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN
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

  -- 4. Resolução Canônica do Grupo (grupos_consorcio)
  IF v_contratacao.grupo_id IS NOT NULL THEN
    SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id = v_contratacao.grupo_id;
  END IF;

  IF v_grupo.id IS NULL AND v_contratacao.grupo_nome IS NOT NULL THEN
    SELECT * INTO v_grupo FROM public.grupos_consorcio
    WHERE (codigo_grupo = v_contratacao.grupo_nome OR codigo_grupo = regexp_replace(v_contratacao.grupo_nome, 'D', '', 'g'))
      AND administradora_id IS NOT NULL
    ORDER BY ativo DESC, created_at DESC LIMIT 1;
  END IF;

  IF v_grupo.id IS NULL THEN
    -- Tenta extrair grupo de dados_simulacao
    IF v_dados->>'grupoId' IS NOT NULL AND v_dados->>'grupoId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id = (v_dados->>'grupoId')::uuid;
    ELSIF v_dados#>>'{selecoes,0,grupoId}' IS NOT NULL AND v_dados#>>'{selecoes,0,grupoId}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id = (v_dados#>>'{selecoes,0,grupoId}')::uuid;
    END IF;
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
    v_grupo.prazo_total,
    v_grupo.prazo_meses,
    180
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

  -- Se não encontrou por ID exato, busca pelo valor do crédito no grupo
  IF v_opcao.id IS NULL AND v_credito IS NOT NULL THEN
    SELECT * INTO v_opcao FROM public.grupos_cotas
    WHERE grupo_id = v_grupo.id
      AND abs(valor_credito - v_credito) < 0.01
      AND (ativo IS TRUE OR ativo IS NULL)
      AND (status IS NULL OR (status NOT ILIKE 'inativo' AND status NOT ILIKE 'esgotado'))
    ORDER BY ordem ASC, created_at DESC LIMIT 1;
  END IF;

  -- Se ainda não encontrou, busca a opção mais próxima do grupo
  IF v_opcao.id IS NULL AND v_credito IS NOT NULL THEN
    SELECT * INTO v_opcao FROM public.grupos_cotas
    WHERE grupo_id = v_grupo.id
      AND (ativo IS TRUE OR ativo IS NULL)
      AND (status IS NULL OR (status NOT ILIKE 'inativo' AND status NOT ILIKE 'esgotado'))
    ORDER BY abs(valor_credito - v_credito) ASC, ordem ASC LIMIT 1;
  END IF;

  -- Se o grupo não possuía cotas cadastradas em grupos_cotas, cria a cota canônica
  IF v_opcao.id IS NULL AND v_credito IS NOT NULL AND v_credito > 0 THEN
    INSERT INTO public.grupos_cotas (grupo_id, valor_credito, valor_parcela, prazo, ativo, status, ordem)
    VALUES (v_grupo.id, v_credito, COALESCE(v_parcela, 0), v_prazo, true, 'Disponível', 0)
    RETURNING * INTO v_opcao;
  END IF;

  v_opcao_id := v_opcao.id;
  IF v_opcao_id IS NULL THEN
    RAISE EXCEPTION 'Opção de cota não encontrada para o grupo ou indisponível';
  END IF;

  -- Reafirma valores
  v_credito := COALESCE(v_credito, v_opcao.valor_credito);
  v_parcela := COALESCE(v_parcela, v_opcao.valor_parcela);
  v_prazo := COALESCE(v_prazo, v_opcao.prazo, v_grupo.prazo_total, 180);

  IF v_credito IS NULL OR v_credito <= 0 OR v_parcela IS NULL OR v_parcela <= 0 OR v_prazo IS NULL OR v_prazo <= 0 THEN
    RAISE EXCEPTION 'Dados monetários/prazo inválidos na contratação';
  END IF;

  -- 8. Resolução Canônica da Modalidade de Comissão (V2)
  SELECT administradora_modalidade_id INTO v_modalidade_id
  FROM public.grupos_modalidades_disponiveis
  WHERE grupo_id = v_grupo.id AND ativo = true
  ORDER BY ordem ASC LIMIT 1;

  IF v_modalidade_id IS NULL THEN
    v_modalidade_id := v_grupo.modalidade_comissao_id;
  END IF;

  IF v_modalidade_id IS NULL AND v_grupo.administradora_id IS NOT NULL THEN
    SELECT id INTO v_modalidade_id
    FROM public.administradora_modalidades_comissao
    WHERE administradora_id = v_grupo.administradora_id AND ativo = true
    ORDER BY created_at ASC LIMIT 1;
  END IF;

  -- Garante que grupo_cota_modalidade_valores e grupos_modalidades_disponiveis estejam íntegros para o trigger V2
  IF v_modalidade_id IS NOT NULL AND v_opcao_id IS NOT NULL THEN
    INSERT INTO public.grupos_modalidades_disponiveis (grupo_id, administradora_modalidade_id, ativo, ordem)
    VALUES (v_grupo.id, v_modalidade_id, true, 0)
    ON CONFLICT (grupo_id, administradora_modalidade_id) DO UPDATE SET ativo = true;

    INSERT INTO public.grupo_cota_modalidade_valores (grupo_cota_id, administradora_modalidade_id, valor_parcela, percentual_reducao, ativo)
    VALUES (v_opcao_id, v_modalidade_id, v_parcela, NULL, true)
    ON CONFLICT (grupo_cota_id, administradora_modalidade_id) DO UPDATE SET valor_parcela = EXCLUDED.valor_parcela, ativo = true;
  END IF;

  -- 9. Montagem do Snapshot Imutável
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
    'prazo', v_prazo,
    'data_conversao', now()
  );

  -- 10. Inserir em Vendas
  INSERT INTO public.vendas (
    empresa_id, lead_id, contratacao_id, cliente_nome, cliente_cpf_cnpj, cliente_email, cliente_telefone,
    administradora_id, grupo_id, opcao_cota_id, modalidade_comissao_id, participante_comercial_id, organizacao_parceira_id,
    valor_credito, prazo, parcela, status, snapshot_venda
  ) VALUES (
    p_empresa_id, v_contratacao.lead_id, p_contratacao_id,
    COALESCE(NULLIF(trim(v_contratacao.nome), ''), 'Cliente Consórcio'),
    COALESCE(v_contratacao.cpf, v_contratacao.cnpj),
    v_contratacao.email, v_contratacao.telefone,
    v_grupo.administradora_id, v_grupo.id, v_opcao_id, v_modalidade_id,
    v_contratacao.participante_comercial_id, v_contratacao.organizacao_parceira_id,
    v_credito, v_prazo, v_parcela, 'confirmada', v_snapshot
  ) RETURNING * INTO v_venda;

  -- 11. Inserir em Cotas Definitivas
  INSERT INTO public.cotas_definitivas (
    empresa_id, venda_id, administradora_id, grupo_id, numero_grupo, numero_cota, valor_credito, prazo, parcela,
    status, participante_comercial_id, organizacao_parceira_id, snapshot_cota
  ) VALUES (
    p_empresa_id, v_venda.id, v_grupo.administradora_id, v_grupo.id, v_grupo.codigo_grupo,
    NULLIF(v_dados->>'numero_cota', ''),
    v_credito, v_prazo, v_parcela, 'ativa',
    v_contratacao.participante_comercial_id, v_contratacao.organizacao_parceira_id, v_snapshot
  ) RETURNING * INTO v_cota;

  -- 12. Sincronizar contratação e lead
  UPDATE public.contratacoes_online
  SET
    status = 'finalizada',
    grupo_id = v_grupo.id,
    cota_id = v_opcao_id::text,
    status_operacional_erp = 'FORMALIZADA',
    formalizado_em = COALESCE(formalizado_em, now()),
    finalizado_em = COALESCE(finalizado_em, now()),
    updated_at = now()
  WHERE id = p_contratacao_id;

  IF v_contratacao.lead_id IS NOT NULL THEN
    UPDATE public.leads SET status = 'convertido', updated_at = now()
    WHERE id = v_contratacao.lead_id AND empresa_id = p_empresa_id;
  END IF;

  -- 13. Previsões de Comissão e Resposta
  SELECT public.rpc_gerar_previsoes_comissao(p_empresa_id, v_venda.id, p_idempotency_key || ':comissao') INTO v_previsoes;
  v_response := jsonb_build_object('venda', to_jsonb(v_venda), 'cotaDefinitiva', to_jsonb(v_cota), 'previsoes', v_previsoes, 'reused', false);

  INSERT INTO public.operacoes_idempotentes(empresa_id, operacao, idempotency_key, payload_hash, recurso_id, resposta)
  VALUES (p_empresa_id, 'CONVERSAO_VENDA', p_idempotency_key, v_hash, v_venda.id, v_response);

  RETURN v_response;
END;
$$;

COMMIT;
