-- 327: Repetição de formalização preserva previsões e recebimentos.
BEGIN;
CREATE OR REPLACE FUNCTION public.rpc_converter_contratacao_venda_multicotas(p_empresa_id uuid, p_contratacao_id uuid, p_quantidade_cotas integer, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_contratacao public.contratacoes_online%ROWTYPE;
  v_venda public.vendas%ROWTYPE;
  v_cota_base public.cotas_definitivas%ROWTYPE;
  v_opcao public.grupos_cotas%ROWTYPE;
  v_core jsonb;
  v_venda_existia boolean;
  v_response jsonb;
  v_cotas jsonb;
  v_quantidade_esperada integer;
  v_ordem integer;
  v_credito_total numeric(15,2);
  v_parcela_total numeric(15,2);
  v_parcela_base numeric(15,2);
  v_parcela_cota numeric(15,2);
BEGIN
  IF p_quantidade_cotas IS NULL OR p_quantidade_cotas < 1 OR p_quantidade_cotas > 100 THEN
    RAISE EXCEPTION 'A quantidade de cotas deve estar entre 1 e 100';
  END IF;
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id, 'formalizar_vendas') THEN
    RAISE EXCEPTION 'Sem permissão para formalizar vendas nesta empresa';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_empresa_id::text || ':CONVERSAO_MULTICOTAS:' || p_contratacao_id::text, 0)
  );

  SELECT * INTO v_contratacao
  FROM public.contratacoes_online
  WHERE id = p_contratacao_id
    AND empresa_id = p_empresa_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contratação não encontrada na empresa'; END IF;

  v_quantidade_esperada := COALESCE(
    CASE WHEN v_contratacao.dados_simulacao->>'quantidade_cotas_formalizacao' ~ '^[0-9]+$'
      THEN (v_contratacao.dados_simulacao->>'quantidade_cotas_formalizacao')::integer END,
    CASE WHEN v_contratacao.dados_simulacao#>>'{selecoes,0,config,quantidadeCotas}' ~ '^[0-9]+$'
      THEN (v_contratacao.dados_simulacao#>>'{selecoes,0,config,quantidadeCotas}')::integer END,
    CASE WHEN v_contratacao.dados_simulacao#>>'{selecoes,0,resultado,quantidadeCotas}' ~ '^[0-9]+$'
      THEN (v_contratacao.dados_simulacao#>>'{selecoes,0,resultado,quantidadeCotas}')::integer END,
    CASE WHEN v_contratacao.dados_simulacao#>>'{totais,totalCotas}' ~ '^[0-9]+$'
      THEN (v_contratacao.dados_simulacao#>>'{totais,totalCotas}')::integer END
  );

  IF NULLIF(v_contratacao.dados_simulacao#>>'{snapshot_calculo,hash_sha256}', '') IS NOT NULL
     AND v_quantidade_esperada IS NOT NULL
     AND p_quantidade_cotas <> v_quantidade_esperada THEN
    RAISE EXCEPTION 'Quantidade de cotas diverge da proposta aceita; gere uma nova proposta';
  END IF;

  IF v_contratacao.cota_id IS NULL
     OR v_contratacao.cota_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Produto/cota canônico obrigatório';
  END IF;
  SELECT * INTO v_opcao
  FROM public.grupos_cotas
  WHERE id = v_contratacao.cota_id::uuid
    AND grupo_id = v_contratacao.grupo_id
    AND ativo IS TRUE;
  IF NOT FOUND OR v_opcao.valor_credito IS NULL OR v_opcao.valor_credito <= 0 THEN
    RAISE EXCEPTION 'Produto/cota não pertence ao grupo ou está indisponível';
  END IF;

  v_credito_total := COALESCE(
    v_contratacao.credito_selecionado,
    CASE WHEN v_contratacao.dados_simulacao->>'valor_credito' ~ '^[0-9]+([.][0-9]+)?$'
      THEN (v_contratacao.dados_simulacao->>'valor_credito')::numeric END,
    CASE WHEN v_contratacao.dados_simulacao#>>'{totais,somaCotas}' ~ '^[0-9]+([.][0-9]+)?$'
      THEN (v_contratacao.dados_simulacao#>>'{totais,somaCotas}')::numeric END
  );
  v_parcela_total := COALESCE(
    v_contratacao.parcela_estimada,
    CASE WHEN v_contratacao.dados_simulacao->>'valor_parcela' ~ '^[0-9]+([.][0-9]+)?$'
      THEN (v_contratacao.dados_simulacao->>'valor_parcela')::numeric END,
    CASE WHEN v_contratacao.dados_simulacao#>>'{totais,primeiraParcela}' ~ '^[0-9]+([.][0-9]+)?$'
      THEN (v_contratacao.dados_simulacao#>>'{totais,primeiraParcela}')::numeric END
  );
  IF v_credito_total IS NULL OR v_credito_total <= 0 OR v_parcela_total IS NULL OR v_parcela_total <= 0 THEN
    RAISE EXCEPTION 'Proposta sem valores comerciais aceitos e preservados';
  END IF;
  IF abs(v_credito_total - (v_opcao.valor_credito * p_quantidade_cotas)) > 0.05 THEN
    INSERT INTO public.contratacoes_formalizacao_historico(
      empresa_id, contratacao_id, evento, descricao, dados
    ) VALUES (
      p_empresa_id,
      p_contratacao_id,
      'DADOS_COMERCIAIS_AJUSTADOS',
      'Montante total reconciliado pelo produto canônico e pela quantidade de cotas antes da formalização.',
      jsonb_build_object(
        'campo', 'credito_selecionado',
        'valor_anterior', v_credito_total,
        'valor_unitario_canonico', v_opcao.valor_credito,
        'quantidade_cotas', p_quantidade_cotas,
        'valor_corrigido', round(v_opcao.valor_credito * p_quantidade_cotas, 2),
        'motivo', 'RECONCILIACAO_PRODUTO_QUANTIDADE'
      )
    );
  END IF;

  -- Grupo, produto e quantidade validados são a fonte operacional do montante.
  v_credito_total := round(v_opcao.valor_credito * p_quantidade_cotas, 2);

  -- O conversor canônico mantém toda a validação de tenant, participantes,
  -- comissão e idempotência. A extensão abaixo apenas normaliza a cardinalidade.
  -- A resposta append-only do núcleo pode preservar reused=false da primeira
  -- execução. Consultar a venda sob o lock antes de chamar o núcleo evita
  -- reconstruir previsões que já possuem recebimentos vinculados.
  SELECT EXISTS (
    SELECT 1 FROM public.vendas
    WHERE empresa_id = p_empresa_id AND contratacao_id = p_contratacao_id
  ) INTO v_venda_existia;

  v_core := public.rpc_converter_contratacao_venda(
    p_empresa_id,
    p_contratacao_id,
    p_idempotency_key
  );

  SELECT * INTO v_venda
  FROM public.vendas
  WHERE empresa_id = p_empresa_id
    AND contratacao_id = p_contratacao_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversão canônica não retornou a venda'; END IF;

  IF COALESCE((v_venda.snapshot_venda->>'quantidade_cotas')::integer, p_quantidade_cotas) <> p_quantidade_cotas THEN
    RAISE EXCEPTION 'Venda já formalizada com outra quantidade de cotas';
  END IF;

  SELECT * INTO v_cota_base
  FROM public.cotas_definitivas
  WHERE empresa_id = p_empresa_id
    AND venda_id = v_venda.id
  ORDER BY ordem_cota, created_at, id
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda existente sem cota definitiva íntegra'; END IF;

  v_parcela_base := trunc((v_parcela_total * 100) / p_quantidade_cotas) / 100;

  UPDATE public.vendas SET
    quantidade_cotas = p_quantidade_cotas,
    valor_credito = v_credito_total,
    parcela = v_parcela_total,
    snapshot_venda = COALESCE(snapshot_venda, '{}'::jsonb) || jsonb_build_object(
      'quantidade_cotas', p_quantidade_cotas,
      'valor_credito_total', v_credito_total,
      'valor_credito_unitario', v_opcao.valor_credito,
      'valor_parcela_total', v_parcela_total
    ),
    updated_at = now()
  WHERE id = v_venda.id
  RETURNING * INTO v_venda;

  -- O núcleo cria a primeira previsão antes de conhecer a cardinalidade total.
  -- Reconstrói imediatamente, ainda sem movimentação financeira, sobre o total
  -- reconciliado; o trigger multicotas apenas distribui esse total entre as cotas.
  IF NOT v_venda_existia THEN
    v_core := jsonb_set(
      v_core,
      '{previsoes}',
      public.rpc_gerar_previsoes_comissao_v2(
        p_empresa_id,
        v_venda.id,
        p_idempotency_key || ':credito-total-multicotas'
      ),
      true
    );
  END IF;

  UPDATE public.cotas_definitivas SET
    ordem_cota = 1,
    valor_credito = v_opcao.valor_credito,
    parcela = CASE WHEN p_quantidade_cotas = 1 THEN v_parcela_total ELSE v_parcela_base END,
    snapshot_cota = COALESCE(snapshot_cota, '{}'::jsonb) || jsonb_build_object(
      'ordem_cota', 1,
      'quantidade_cotas', p_quantidade_cotas,
      'valor_credito_total_venda', v_credito_total,
      'valor_parcela_total_venda', v_parcela_total
    ),
    updated_at = now()
  WHERE id = v_cota_base.id
  RETURNING * INTO v_cota_base;

  IF p_quantidade_cotas > 1 THEN
    FOR v_ordem IN 2..p_quantidade_cotas LOOP
      v_parcela_cota := CASE
        WHEN v_ordem = p_quantidade_cotas
          THEN v_parcela_total - (v_parcela_base * (p_quantidade_cotas - 1))
        ELSE v_parcela_base
      END;
      INSERT INTO public.cotas_definitivas(
        empresa_id, venda_id, administradora_id, grupo_id, numero_grupo, numero_cota,
        ordem_cota, valor_credito, prazo, parcela, status, participante_comercial_id,
        organizacao_parceira_id, snapshot_cota, prazo_original_grupo,
        parcelas_restantes_venda, prazo_referencia_em
      ) VALUES (
        v_cota_base.empresa_id, v_cota_base.venda_id, v_cota_base.administradora_id,
        v_cota_base.grupo_id, v_cota_base.numero_grupo, NULL, v_ordem,
        v_opcao.valor_credito, v_cota_base.prazo, v_parcela_cota, v_cota_base.status,
        v_cota_base.participante_comercial_id, v_cota_base.organizacao_parceira_id,
        COALESCE(v_cota_base.snapshot_cota, '{}'::jsonb) || jsonb_build_object('ordem_cota', v_ordem),
        v_cota_base.prazo_original_grupo, v_cota_base.parcelas_restantes_venda,
        v_cota_base.prazo_referencia_em
      )
      ON CONFLICT (venda_id, ordem_cota) DO NOTHING;
    END LOOP;
  END IF;

  UPDATE public.contratacoes_online SET
    quantidade_cotas = p_quantidade_cotas,
    credito_selecionado = v_credito_total,
    dados_simulacao = COALESCE(dados_simulacao, '{}'::jsonb)
      || jsonb_build_object(
        'quantidade_cotas_formalizacao', p_quantidade_cotas,
        'credito_total_formalizacao', v_credito_total,
        'credito_unitario_formalizacao', v_opcao.valor_credito
      ),
    updated_at = now()
  WHERE id = p_contratacao_id
    AND empresa_id = p_empresa_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.ordem_cota), '[]'::jsonb)
    INTO v_cotas
  FROM public.cotas_definitivas c
  WHERE c.empresa_id = p_empresa_id
    AND c.venda_id = v_venda.id;

  IF jsonb_array_length(v_cotas) <> p_quantidade_cotas THEN
    RAISE EXCEPTION 'Quantidade de cotas geradas diverge da contratação';
  END IF;

  v_response := jsonb_build_object(
    'venda', to_jsonb(v_venda),
    'cotaDefinitiva', v_cotas->0,
    'cotasDefinitivas', v_cotas,
    'previsoes', v_core->'previsoes',
    'reused', v_venda_existia
  );

  -- operacoes_idempotentes e append-only; a resposta multicotas e
  -- reconstruida deterministicamente a partir de cotas_definitivas.

  INSERT INTO public.contratacoes_formalizacao_historico(
    empresa_id, contratacao_id, evento, descricao, dados
  ) SELECT
    p_empresa_id,
    p_contratacao_id,
    'COTAS_DEFINITIVAS_GERADAS',
    format('%s cota(s) definitiva(s) vinculada(s) à mesma venda.', p_quantidade_cotas),
    jsonb_build_object(
      'venda_id', v_venda.id,
      'quantidade_cotas', p_quantidade_cotas,
      'cotas_ids', (SELECT jsonb_agg(item->>'id') FROM jsonb_array_elements(v_cotas) item)
    )
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.contratacoes_formalizacao_historico h
    WHERE h.empresa_id = p_empresa_id
      AND h.contratacao_id = p_contratacao_id
      AND h.evento = 'COTAS_DEFINITIVAS_GERADAS'
  );

  RETURN v_response;
END;
$function$;
COMMIT;
