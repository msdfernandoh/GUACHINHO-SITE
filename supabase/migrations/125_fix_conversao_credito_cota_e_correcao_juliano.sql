-- Migration 125: Resolução correta do valor de crédito da cota e recálculo da venda do Juliano
BEGIN;

-- 1. Atualizar rpc_converter_contratacao_venda para respeitar estritamente a cota escolhida
CREATE OR REPLACE FUNCTION public.rpc_converter_contratacao_venda(
  p_empresa_id uuid,
  p_contratacao_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
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
  v_previsoes jsonb;
  v_response jsonb;
  v_hash text;
  v_dados jsonb;
  v_credito numeric;
  v_parcela numeric;
  v_prazo integer;
  v_opcao_id uuid;
  v_opcao_text text;
  v_modalidade_id uuid;
  v_tipo_id uuid;
  v_snapshot jsonb;
  v_perfil_principal_id uuid;
  v_perfil_secundario_id uuid;
  v_data_1 date;
  v_data_2 date;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;

  v_hash := md5(p_contratacao_id::text);

  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text || ':CONVERSAO_VENDA:' || p_idempotency_key, 0));

  SELECT resposta INTO v_response
  FROM public.operacoes_idempotentes
  WHERE empresa_id = p_empresa_id AND operacao = 'CONVERSAO_VENDA' AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN v_response;
  END IF;

  SELECT * INTO v_contratacao
  FROM public.contratacoes_online
  WHERE id = p_contratacao_id AND empresa_id = p_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contratação não encontrada no tenant';
  END IF;

  IF v_contratacao.empresa_id IS NULL OR v_contratacao.empresa_id <> p_empresa_id THEN
    RAISE EXCEPTION 'Contratação pertence a outro tenant';
  END IF;

  -- Se a contratação já virou venda, retorna a venda e cota existentes
  SELECT * INTO v_venda FROM public.vendas WHERE empresa_id = p_empresa_id AND contratacao_id = p_contratacao_id;
  IF FOUND THEN
    SELECT * INTO v_cota FROM public.cotas_definitivas WHERE venda_id = v_venda.id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Venda existente sem cota definitiva íntegra';
    END IF;
    SELECT public.rpc_gerar_previsoes_comissao_v2(p_empresa_id, v_venda.id, p_idempotency_key || ':comissao') INTO v_previsoes;
    v_response := jsonb_build_object('venda', to_jsonb(v_venda), 'cotaDefinitiva', to_jsonb(v_cota), 'previsoes', v_previsoes, 'reused', true);
    INSERT INTO public.operacoes_idempotentes(empresa_id, operacao, idempotency_key, payload_hash, recurso_id, resposta)
    VALUES (p_empresa_id, 'CONVERSAO_VENDA', p_idempotency_key, v_hash, v_venda.id, v_response);
    RETURN v_response;
  END IF;

  v_dados := COALESCE(v_contratacao.dados_simulacao, '{}'::jsonb);

  -- Resolução dos Perfis Comerciais e Datas
  IF (v_dados->>'perfil_principal_id') IS NOT NULL AND (v_dados->>'perfil_principal_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_perfil_principal_id := (v_dados->>'perfil_principal_id')::uuid;
  END IF;

  IF (v_dados->>'perfil_secundario_id') IS NOT NULL AND (v_dados->>'perfil_secundario_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_perfil_secundario_id := (v_dados->>'perfil_secundario_id')::uuid;
  END IF;

  IF (v_dados->>'data_primeira_parcela') IS NOT NULL AND (v_dados->>'data_primeira_parcela') ~ '^d{4}-d{2}-d{2}$' THEN
    v_data_1 := (v_dados->>'data_primeira_parcela')::date;
  END IF;

  IF (v_dados->>'data_segunda_parcela') IS NOT NULL AND (v_dados->>'data_segunda_parcela') ~ '^d{4}-d{2}-d{2}$' THEN
    v_data_2 := (v_dados->>'data_segunda_parcela')::date;
  END IF;

  -- Resolução Canônica do Grupo
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
    IF v_dados->>'grupoId' IS NOT NULL AND v_dados->>'grupoId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id = (v_dados->>'grupoId')::uuid;
    ELSIF v_dados#>>'{selecoes,0,grupoId}' IS NOT NULL AND v_dados#>>'{selecoes,0,grupoId}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id = (v_dados#>>'{selecoes,0,grupoId}')::uuid;
    END IF;
  END IF;

  IF v_grupo.id IS NULL OR v_grupo.administradora_id IS NULL THEN
    RAISE EXCEPTION 'Grupo/administradora inválidos na contratação';
  END IF;

  -- Auto-resolução do tipo de administradora no grupo se estiver nulo
  IF v_grupo.tipo_administradora_id IS NULL THEN
    SELECT id INTO v_tipo_id FROM public.administradora_tipos
    WHERE administradora_id = v_grupo.administradora_id
      AND (
        lower(nome) = lower(COALESCE(v_grupo.modalidade, ''))
        OR lower(codigo) = lower(COALESCE(v_grupo.modalidade, ''))
        OR (lower(COALESCE(v_grupo.modalidade, '')) LIKE '%imov%' AND lower(nome) LIKE '%imov%')
        OR (lower(COALESCE(v_grupo.modalidade, '')) LIKE '%veic%' AND lower(nome) LIKE '%veic%')
        OR (lower(COALESCE(v_grupo.modalidade, '')) LIKE '%auto%' AND lower(nome) LIKE '%auto%')
      )
      AND ativo
    LIMIT 1;

    IF v_tipo_id IS NULL THEN
      SELECT id INTO v_tipo_id FROM public.administradora_tipos
      WHERE administradora_id = v_grupo.administradora_id AND ativo
      ORDER BY created_at ASC LIMIT 1;
    END IF;

    IF v_tipo_id IS NOT NULL THEN
      UPDATE public.grupos_consorcio SET tipo_administradora_id = v_tipo_id WHERE id = v_grupo.id;
      v_grupo.tipo_administradora_id := v_tipo_id;
    END IF;
  END IF;

  -- Resolução Canônica do Produto/Cota (grupos_cotas)
  v_opcao_text := NULLIF(COALESCE(v_contratacao.cota_id, v_dados->>'cotaId', v_dados->>'opcao_cota_id', v_dados#>>'{selecoes,0,cotaId}'), '');
  IF v_opcao_text IS NOT NULL AND v_opcao_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_opcao_id := v_opcao_text::uuid;
    SELECT * INTO v_opcao FROM public.grupos_cotas
    WHERE id = v_opcao_id AND grupo_id = v_grupo.id;
  END IF;

  -- Se cota explícita encontrada no grupo, o crédito e parcela VÊM DA COTA ESCOLHIDA!
  IF v_opcao.id IS NOT NULL THEN
    v_credito := v_opcao.valor_credito;
    v_parcela := v_opcao.valor_parcela;
    v_prazo := COALESCE(v_grupo.prazo_total, v_contratacao.prazo, 180);
  ELSE
    -- Se não encontrou cota por ID, busca por crédito aproximado
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
      180
    );

    IF v_credito IS NOT NULL THEN
      SELECT * INTO v_opcao FROM public.grupos_cotas
      WHERE grupo_id = v_grupo.id
        AND abs(valor_credito - v_credito) < 0.01
        AND (ativo IS TRUE OR ativo IS NULL)
        AND (status IS NULL OR (status NOT ILIKE 'inativo' AND status NOT ILIKE 'esgotado'))
      ORDER BY ordem ASC, created_at DESC LIMIT 1;
    END IF;

    IF v_opcao.id IS NULL AND v_credito IS NOT NULL THEN
      SELECT * INTO v_opcao FROM public.grupos_cotas
      WHERE grupo_id = v_grupo.id
        AND (ativo IS TRUE OR ativo IS NULL)
        AND (status IS NULL OR (status NOT ILIKE 'inativo' AND status NOT ILIKE 'esgotado'))
      ORDER BY abs(valor_credito - v_credito) ASC, ordem ASC LIMIT 1;
    END IF;

    IF v_opcao.id IS NULL AND v_credito IS NOT NULL AND v_credito > 0 THEN
      INSERT INTO public.grupos_cotas (grupo_id, valor_credito, valor_parcela, ativo, status, ordem)
      VALUES (v_grupo.id, v_credito, COALESCE(v_parcela, 0), true, 'Disponível', 0)
      RETURNING * INTO v_opcao;
    END IF;
  END IF;

  v_opcao_id := v_opcao.id;
  IF v_opcao_id IS NULL THEN
    RAISE EXCEPTION 'Opção de cota não encontrada para o grupo';
  END IF;

  v_credito := COALESCE(v_opcao.valor_credito, v_credito);
  v_parcela := COALESCE(v_opcao.valor_parcela, v_parcela);
  v_prazo := COALESCE(v_prazo, v_grupo.prazo_total, 180);

  -- Resolução Canônica da Modalidade de Comissão (V2)
  IF (v_dados->>'modalidade_comissao_id') IS NOT NULL AND (v_dados->>'modalidade_comissao_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_modalidade_id := (v_dados->>'modalidade_comissao_id')::uuid;
  END IF;

  IF v_modalidade_id IS NULL THEN
    SELECT administradora_modalidade_id INTO v_modalidade_id
    FROM public.grupos_modalidades_disponiveis
    WHERE grupo_id = v_grupo.id AND ativo = true
    ORDER BY ordem ASC LIMIT 1;
  END IF;

  IF v_modalidade_id IS NULL THEN
    v_modalidade_id := v_grupo.modalidade_comissao_id;
  END IF;

  IF v_modalidade_id IS NULL AND v_grupo.administradora_id IS NOT NULL THEN
    SELECT id INTO v_modalidade_id
    FROM public.administradora_modalidades_comissao
    WHERE administradora_id = v_grupo.administradora_id AND ativo = true
    ORDER BY (codigo = 'INTEGRAL') DESC, created_at ASC LIMIT 1;
  END IF;

  -- Auto-resolução ou Criação do Cliente no ERP
  IF v_contratacao.cliente_id IS NULL THEN
    IF v_contratacao.cpf IS NOT NULL OR v_contratacao.cnpj IS NOT NULL THEN
      SELECT id INTO v_contratacao.cliente_id FROM public.clientes
      WHERE empresa_id = p_empresa_id AND documento_normalizado = regexp_replace(COALESCE(v_contratacao.cpf, v_contratacao.cnpj), 'D', '', 'g')
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
        regexp_replace(COALESCE(v_contratacao.cpf, v_contratacao.cnpj, ''), 'D', '', 'g'),
        v_contratacao.email, v_contratacao.telefone,
        v_contratacao.cep, v_contratacao.endereco, v_contratacao.numero, v_contratacao.complemento,
        v_contratacao.bairro, v_contratacao.cidade, v_contratacao.uf,
        v_contratacao.participante_comercial_id, 'contratacao_assinada', 'ativo', p_contratacao_id
      ) RETURNING id INTO v_contratacao.cliente_id;
    END IF;
  END IF;

  -- Montagem do Snapshot Imutável com todas as propriedades no root
  v_snapshot := jsonb_build_object(
    'dados_simulacao', v_dados,
    'grupo_id', v_grupo.id,
    'grupo_codigo', v_grupo.codigo_grupo,
    'administradora_id', v_grupo.administradora_id,
    'opcao_cota_id', v_opcao_id,
    'modalidade_comissao_id', v_modalidade_id,
    'tipo_administradora_id', v_grupo.tipo_administradora_id,
    'perfil_principal_id', v_perfil_principal_id,
    'perfil_secundario_id', v_perfil_secundario_id,
    'percentual_franqueadora', v_dados->>'percentual_franqueadora',
    'cronograma_secundario', v_dados->>'cronograma_secundario',
    'fracao_secundario', v_contratacao.participante_secundario_fracao_percentual,
    'data_primeira_parcela', v_data_1,
    'data_segunda_parcela', v_data_2,
    'tipo_bem', COALESCE(v_contratacao.tipo_bem, v_dados->>'tipoBem', 'Consórcio'),
    'modalidade', COALESCE(v_dados->>'modalidade', v_dados->>'plano', 'Integral'),
    'valor_credito', v_credito,
    'valor_parcela', v_parcela,
    'prazo', v_prazo,
    'data_conversao', now()
  );

  -- Inserir em Vendas com crédito e parcela corretos
  INSERT INTO public.vendas (
    empresa_id, cliente_id, lead_id, contratacao_id, cliente_nome, cliente_cpf_cnpj, cliente_email, cliente_telefone,
    administradora_id, grupo_id, opcao_cota_id, modalidade_comissao_id, participante_comercial_id, organizacao_parceira_id,
    participante_secundario_id, participante_secundario_fracao_percentual, perfil_principal_id, perfil_secundario_id,
    data_primeira_parcela, data_segunda_parcela,
    valor_credito, prazo, parcela, status, snapshot_venda
  ) VALUES (
    p_empresa_id, v_contratacao.cliente_id, v_contratacao.lead_id, p_contratacao_id,
    COALESCE(NULLIF(trim(v_contratacao.nome), ''), 'Cliente Consórcio'),
    COALESCE(v_contratacao.cpf, v_contratacao.cnpj),
    v_contratacao.email, v_contratacao.telefone,
    v_grupo.administradora_id, v_grupo.id, v_opcao_id, v_modalidade_id,
    v_contratacao.participante_comercial_id, v_contratacao.organizacao_parceira_id,
    v_contratacao.participante_secundario_id, v_contratacao.participante_secundario_fracao_percentual,
    v_perfil_principal_id, v_perfil_secundario_id,
    v_data_1, v_data_2,
    v_credito, v_prazo, v_parcela, 'confirmada', v_snapshot
  ) RETURNING * INTO v_venda;

  -- Inserir em Cotas Definitivas
  INSERT INTO public.cotas_definitivas (
    empresa_id, venda_id, administradora_id, grupo_id, numero_grupo, numero_cota, valor_credito, prazo, parcela,
    status, participante_comercial_id, organizacao_parceira_id, snapshot_cota
  ) VALUES (
    p_empresa_id, v_venda.id, v_grupo.administradora_id, v_grupo.id, v_grupo.codigo_grupo,
    NULLIF(v_dados->>'numero_cota', ''),
    v_credito, v_prazo, v_parcela, 'ativa',
    v_contratacao.participante_comercial_id, v_contratacao.organizacao_parceira_id, v_snapshot
  ) RETURNING * INTO v_cota;

  -- Sincronizar contratação
  UPDATE public.contratacoes_online
  SET
    status = 'finalizada',
    cliente_id = v_contratacao.cliente_id,
    grupo_id = v_grupo.id,
    cota_id = v_opcao_id::text,
    credito_selecionado = v_credito,
    parcela_estimada = v_parcela,
    prazo = v_prazo,
    status_operacional_erp = 'FORMALIZADA',
    pendencia_codigo = NULL,
    pendencia_descricao = NULL,
    formalizado_em = COALESCE(formalizado_em, now()),
    finalizado_em = COALESCE(finalizado_em, now()),
    updated_at = now()
  WHERE id = p_contratacao_id;

  IF v_contratacao.lead_id IS NOT NULL THEN
    UPDATE public.leads
    SET status = 'ganho', updated_at = now()
    WHERE id = v_contratacao.lead_id;
  END IF;

  -- Gerar previsões de comissão V2
  SELECT public.rpc_gerar_previsoes_comissao_v2(p_empresa_id, v_venda.id, p_idempotency_key || ':comissao') INTO v_previsoes;

  v_response := jsonb_build_object(
    'venda', to_jsonb(v_venda),
    'cotaDefinitiva', to_jsonb(v_cota),
    'previsoes', v_previsoes,
    'reused', false
  );

  INSERT INTO public.operacoes_idempotentes(empresa_id, operacao, idempotency_key, payload_hash, recurso_id, resposta)
  VALUES (p_empresa_id, 'CONVERSAO_VENDA', p_idempotency_key, v_hash, v_venda.id, v_response);

  RETURN v_response;
END;
$$;

-- 2. Recálculo e Correção Direta da Venda do Juliano Fernandes de Avila (Cota 212.000 no Grupo 1453)
DO $$
DECLARE
  v_venda_juliano record;
  v_grupo_1453 record;
  v_cota_212k record;
BEGIN
  -- Busca venda do Juliano
  SELECT v.* INTO v_venda_juliano
  FROM public.vendas v
  WHERE v.cliente_cpf_cnpj = '04543587928' OR v.cliente_nome ILIKE '%JULIANO FERNANDES DE AVILA%'
  ORDER BY v.created_at DESC LIMIT 1;

  IF v_venda_juliano.id IS NOT NULL THEN
    -- Busca grupo 1453
    SELECT * INTO v_grupo_1453
    FROM public.grupos_consorcio
    WHERE codigo_grupo = '1453' OR codigo_grupo ILIKE '%1453%'
    ORDER BY ativo DESC LIMIT 1;

    -- Busca cota de 212k
    IF v_grupo_1453.id IS NOT NULL THEN
      SELECT * INTO v_cota_212k
      FROM public.grupos_cotas
      WHERE grupo_id = v_grupo_1453.id AND abs(valor_credito - 212000) < 1
      LIMIT 1;

      -- Atualiza Venda
      UPDATE public.vendas
      SET
        grupo_id = v_grupo_1453.id,
        opcao_cota_id = COALESCE(v_cota_212k.id, opcao_cota_id),
        valor_credito = 212000.00,
        parcela = COALESCE(v_cota_212k.valor_parcela, 807.72),
        prazo = COALESCE(v_grupo_1453.prazo_total, 200),
        snapshot_venda = snapshot_venda || jsonb_build_object(
          'grupo_codigo', '1453',
          'valor_credito', 212000.00,
          'valor_parcela', COALESCE(v_cota_212k.valor_parcela, 807.72),
          'prazo', COALESCE(v_grupo_1453.prazo_total, 200)
        )
      WHERE id = v_venda_juliano.id;

      -- Atualiza Cota Definitiva
      UPDATE public.cotas_definitivas
      SET
        grupo_id = v_grupo_1453.id,
        numero_grupo = '1453',
        valor_credito = 212000.00,
        parcela = COALESCE(v_cota_212k.valor_parcela, 807.72),
        prazo = COALESCE(v_grupo_1453.prazo_total, 200),
        snapshot_cota = snapshot_cota || jsonb_build_object(
          'numero_grupo', '1453',
          'valor_credito', 212000.00,
          'valor_parcela', COALESCE(v_cota_212k.valor_parcela, 807.72)
        )
      WHERE venda_id = v_venda_juliano.id;

      -- Recalcula previsões de comissão (2% de 212.000 = 4.240,00)
      PERFORM public.rpc_gerar_previsoes_comissao_v2(
        v_venda_juliano.empresa_id,
        v_venda_juliano.id,
        'recalculo_juliano_212k:' || v_venda_juliano.id || ':' || extract(epoch from now())::text
      );
    END IF;
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
