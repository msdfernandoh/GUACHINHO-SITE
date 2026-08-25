-- 121: Auto-resolução resiliente de Tipo e Modalidade de Grupos na Formalização de Vendas
BEGIN;

-- 1. Backfill em grupos_consorcio sem tipo_administradora_id
UPDATE public.grupos_consorcio g
SET tipo_administradora_id = (
  SELECT t.id FROM public.administradora_tipos t
  WHERE t.administradora_id = g.administradora_id
    AND (
      lower(t.nome) = lower(COALESCE(g.modalidade, ''))
      OR lower(t.codigo) = lower(COALESCE(g.modalidade, ''))
      OR (lower(COALESCE(g.modalidade, '')) LIKE '%imov%' AND lower(t.nome) LIKE '%imov%')
      OR (lower(COALESCE(g.modalidade, '')) LIKE '%veic%' AND lower(t.nome) LIKE '%veic%')
      OR (lower(COALESCE(g.modalidade, '')) LIKE '%auto%' AND lower(t.nome) LIKE '%auto%')
      OR (lower(COALESCE(g.codigo_grupo, '')) LIKE '%imov%' AND lower(t.nome) LIKE '%imov%')
      OR (lower(COALESCE(g.codigo_grupo, '')) LIKE '%veic%' AND lower(t.nome) LIKE '%veic%')
      OR (lower(COALESCE(g.codigo_grupo, '')) LIKE '%auto%' AND lower(t.nome) LIKE '%auto%')
    )
    AND t.ativo
  LIMIT 1
)
WHERE g.tipo_administradora_id IS NULL AND g.administradora_id IS NOT NULL;

UPDATE public.grupos_consorcio g
SET tipo_administradora_id = (
  SELECT t.id FROM public.administradora_tipos t
  WHERE t.administradora_id = g.administradora_id AND t.ativo
  ORDER BY t.created_at ASC
  LIMIT 1
)
WHERE g.tipo_administradora_id IS NULL AND g.administradora_id IS NOT NULL;

-- 2. Atualizar trigger function comissao_v2_enriquecer_venda para ser 100% auto-resolutiva
CREATE OR REPLACE FUNCTION public.comissao_v2_enriquecer_venda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_grupo record;
  v_tipo record;
  v_modalidade record;
  v_modalidade_texto text;
  v_tipo_id uuid;
  v_modalidade_id uuid;
BEGIN
  SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id = NEW.grupo_id;

  -- 1. Auto-resolução do Tipo de Administradora se estiver nulo
  IF v_grupo.id IS NOT NULL AND v_grupo.tipo_administradora_id IS NULL THEN
    SELECT id INTO v_tipo_id FROM public.administradora_tipos
    WHERE administradora_id = NEW.administradora_id
      AND (
        lower(nome) = lower(COALESCE(v_grupo.modalidade, ''))
        OR lower(codigo) = lower(COALESCE(v_grupo.modalidade, ''))
        OR (lower(COALESCE(v_grupo.modalidade, '')) LIKE '%imov%' AND lower(nome) LIKE '%imov%')
        OR (lower(COALESCE(v_grupo.modalidade, '')) LIKE '%veic%' AND lower(nome) LIKE '%veic%')
        OR (lower(COALESCE(v_grupo.modalidade, '')) LIKE '%auto%' AND lower(nome) LIKE '%auto%')
        OR (lower(COALESCE(v_grupo.codigo_grupo, '')) LIKE '%imov%' AND lower(nome) LIKE '%imov%')
        OR (lower(COALESCE(v_grupo.codigo_grupo, '')) LIKE '%veic%' AND lower(nome) LIKE '%veic%')
        OR (lower(COALESCE(v_grupo.codigo_grupo, '')) LIKE '%auto%' AND lower(nome) LIKE '%auto%')
      )
      AND ativo
    LIMIT 1;

    IF v_tipo_id IS NULL THEN
      SELECT id INTO v_tipo_id FROM public.administradora_tipos
      WHERE administradora_id = NEW.administradora_id AND ativo
      ORDER BY created_at ASC LIMIT 1;
    END IF;

    IF v_tipo_id IS NOT NULL THEN
      UPDATE public.grupos_consorcio SET tipo_administradora_id = v_tipo_id WHERE id = v_grupo.id;
      v_grupo.tipo_administradora_id := v_tipo_id;
    END IF;
  END IF;

  -- 2. Resolução do Tipo
  IF v_grupo.tipo_administradora_id IS NOT NULL THEN
    SELECT * INTO v_tipo FROM public.administradora_tipos WHERE id = v_grupo.tipo_administradora_id AND ativo;
  END IF;

  IF v_tipo.id IS NULL AND NEW.administradora_id IS NOT NULL THEN
    SELECT * INTO v_tipo FROM public.administradora_tipos WHERE administradora_id = NEW.administradora_id AND ativo ORDER BY created_at ASC LIMIT 1;
  END IF;

  -- 3. Resolução da Modalidade
  v_modalidade_texto := COALESCE(NEW.modalidade_comissao_id::text, NEW.snapshot_venda->>'modalidade_comissao_id', NEW.snapshot_venda#>>'{dados_simulacao,modalidade_comissao_id}');
  
  IF v_modalidade_texto IS NOT NULL AND v_modalidade_texto ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_modalidade_id := v_modalidade_texto::uuid;
  END IF;

  IF v_modalidade_id IS NULL AND v_grupo.modalidade_comissao_id IS NOT NULL THEN
    v_modalidade_id := v_grupo.modalidade_comissao_id;
  END IF;

  IF v_modalidade_id IS NULL AND NEW.administradora_id IS NOT NULL THEN
    SELECT id INTO v_modalidade_id FROM public.administradora_modalidades_comissao
    WHERE administradora_id = NEW.administradora_id AND ativo
    ORDER BY (codigo = 'INTEGRAL') DESC, created_at ASC LIMIT 1;
  END IF;

  IF v_modalidade_id IS NOT NULL THEN
    NEW.modalidade_comissao_id := v_modalidade_id;
    SELECT * INTO v_modalidade FROM public.administradora_modalidades_comissao WHERE id = v_modalidade_id;
  END IF;

  -- 4. Garante vínculo em grupos_modalidades_disponiveis
  IF NEW.grupo_id IS NOT NULL AND v_modalidade_id IS NOT NULL THEN
    INSERT INTO public.grupos_modalidades_disponiveis (grupo_id, administradora_modalidade_id, ativo, ordem)
    VALUES (NEW.grupo_id, v_modalidade_id, true, 0)
    ON CONFLICT (grupo_id, administradora_modalidade_id) DO UPDATE SET ativo = true;
  END IF;

  -- 5. Garante valor em grupo_cota_modalidade_valores
  IF NEW.opcao_cota_id IS NOT NULL AND v_modalidade_id IS NOT NULL THEN
    INSERT INTO public.grupo_cota_modalidade_valores (grupo_cota_id, administradora_modalidade_id, valor_parcela, percentual_reducao, ativo)
    VALUES (NEW.opcao_cota_id, v_modalidade_id, COALESCE(NEW.parcela, 0), NULL, true)
    ON CONFLICT (grupo_cota_id, administradora_modalidade_id) DO UPDATE SET valor_parcela = EXCLUDED.valor_parcela, ativo = true;
  END IF;

  NEW.valor_parcela_modalidade := COALESCE(NEW.parcela, 0);

  NEW.snapshot_venda := COALESCE(NEW.snapshot_venda, '{}'::jsonb) || jsonb_build_object(
    'tipo_administradora_id', v_tipo.id,
    'tipo_administradora_codigo', COALESCE(v_tipo.codigo, 'IMOVEL'),
    'modalidade_comissao_id', v_modalidade.id,
    'modalidade_comissao_codigo', COALESCE(v_modalidade.codigo, 'INTEGRAL'),
    'grupo_id', NEW.grupo_id,
    'opcao_cota_id', NEW.opcao_cota_id,
    'valor_credito', NEW.valor_credito,
    'valor_parcela_modalidade', NEW.parcela,
    'plano_condicao', lower(COALESCE(v_modalidade.codigo, 'integral'))
  );

  RETURN NEW;
END;
$$;

-- 3. Atualizar rpc_converter_contratacao_venda para garantir tipo_administradora_id
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
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;

  v_hash := md5(p_contratacao_id::text);

  -- 1. Idempotência por Hash e Lock Transacional
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text || ':CONVERSAO_VENDA:' || p_idempotency_key, 0));

  SELECT resposta INTO v_response
  FROM public.operacoes_idempotentes
  WHERE empresa_id = p_empresa_id AND operacao = 'CONVERSAO_VENDA' AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN v_response;
  END IF;

  -- 2. Carregar contratação com lock
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

  -- 3. Se a contratação já virou venda, retorna a venda e cota existentes
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
        OR (lower(COALESCE(v_grupo.codigo_grupo, '')) LIKE '%imov%' AND lower(nome) LIKE '%imov%')
        OR (lower(COALESCE(v_grupo.codigo_grupo, '')) LIKE '%veic%' AND lower(nome) LIKE '%veic%')
        OR (lower(COALESCE(v_grupo.codigo_grupo, '')) LIKE '%auto%' AND lower(nome) LIKE '%auto%')
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

  -- 5. Validar concessão ativa da Administradora para a Empresa
  IF NOT EXISTS (
    SELECT 1 FROM public.empresa_administradoras ea
    JOIN public.administradoras a ON a.id = ea.administradora_id
    WHERE ea.empresa_id = p_empresa_id AND ea.administradora_id = v_grupo.administradora_id AND ea.status = 'ATIVA' AND a.status = 'ATIVA'
  ) THEN
    -- Auto-ativa a concessão da administradora para o tenant se ainda não constava
    INSERT INTO public.empresa_administradoras (empresa_id, administradora_id, status)
    VALUES (p_empresa_id, v_grupo.administradora_id, 'ATIVA')
    ON CONFLICT (empresa_id, administradora_id) DO UPDATE SET status = 'ATIVA';
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

  IF v_opcao.id IS NULL AND v_credito IS NOT NULL THEN
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

  v_opcao_id := v_opcao.id;
  IF v_opcao_id IS NULL THEN
    RAISE EXCEPTION 'Opção de cota não encontrada para o grupo ou indisponível';
  END IF;

  v_credito := COALESCE(v_credito, v_opcao.valor_credito);
  v_parcela := COALESCE(v_parcela, v_opcao.valor_parcela);
  v_prazo := COALESCE(v_prazo, v_grupo.prazo_total, 180);

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
    ORDER BY (codigo = 'INTEGRAL') DESC, created_at ASC LIMIT 1;
  END IF;

  IF v_modalidade_id IS NOT NULL AND v_opcao_id IS NOT NULL THEN
    INSERT INTO public.grupos_modalidades_disponiveis (grupo_id, administradora_modalidade_id, ativo, ordem)
    VALUES (v_grupo.id, v_modalidade_id, true, 0)
    ON CONFLICT (grupo_id, administradora_modalidade_id) DO UPDATE SET ativo = true;

    INSERT INTO public.grupo_cota_modalidade_valores (grupo_cota_id, administradora_modalidade_id, valor_parcela, percentual_reducao, ativo)
    VALUES (v_opcao_id, v_modalidade_id, v_parcela, NULL, true)
    ON CONFLICT (grupo_cota_id, administradora_modalidade_id) DO UPDATE SET valor_parcela = EXCLUDED.valor_parcela, ativo = true;
  END IF;

  -- 9. Auto-resolução ou Criação do Cliente no ERP
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
    pendencia_codigo = NULL,
    pendencia_descricao = NULL,
    formalizado_em = COALESCE(formalizado_em, now()),
    finalizado_em = COALESCE(finalizado_em, now()),
    updated_at = now()
  WHERE id = p_contratacao_id;

  IF v_contratacao.lead_id IS NOT NULL THEN
    UPDATE public.leads
    SET
      status = 'ganho',
      updated_at = now()
    WHERE id = v_contratacao.lead_id;
  END IF;

  -- 14. Gerar previsões de comissão V2
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

COMMIT;
