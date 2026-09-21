-- Migration 241: Separação Estrita de Valor do Crédito vs. Valor da Parcela Mensal no CRM
-- Resolve a distorção onde parcelas de eventos (R$ 500, R$ 1.000, etc.) eram salvas como crédito do lead.
-- 1. Cria a coluna valor_parcela em public.leads
-- 2. Saneamento dos leads legados (transfere valores <= 5000 de eventos/sorteios para valor_parcela e zera valor_estimado/valor_credito)
-- 3. Atualiza rpc_realizar_checkin_conversacional para gravar em valor_parcela
-- 4. Atualiza rpc_upsert_lead_por_telefone para suportar e persistir valor_credito e valor_parcela de forma independente

-- Passo 1: Adicionar coluna valor_parcela se não existir
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS valor_parcela NUMERIC(15, 2) NULL;

COMMENT ON COLUMN public.leads.valor_parcela IS 'Valor da parcela mensal pretendida ou capacidade mensal de investimento informada pelo cliente.';

-- Passo 2: Saneamento e Backfill dos Leads Existentes
DO $$
DECLARE
  r RECORD;
  v_parcela NUMERIC(15, 2);
  v_cap TEXT;
BEGIN
  FOR r IN
    SELECT id, origem, valor_estimado, valor_simulado, valor_credito, valor_parcela, dados_simulacao, fechado
    FROM public.leads
    WHERE coalesce(fechado, false) = false
      AND (
        origem IN ('evento', 'evento_checkin', 'evento_sorteio', 'qr_unico')
        OR (coalesce(valor_estimado, valor_simulado, 0) > 0 AND coalesce(valor_estimado, valor_simulado, 0) <= 5000)
        OR (dados_simulacao->'qualificacao'->>'capacidade_mensal' IS NOT NULL)
        OR (dados_simulacao->>'valor_mensal_disponivel' IS NOT NULL)
      )
  LOOP
    v_parcela := NULL;
    v_cap := r.dados_simulacao->'qualificacao'->>'capacidade_mensal';

    IF v_cap IS NOT NULL THEN
      v_parcela := CASE
        WHEN v_cap = 'ate_500' THEN 500.00
        WHEN v_cap = '500_1000' THEN 1000.00
        WHEN v_cap = '1000_2000' THEN 2000.00
        WHEN v_cap = 'acima_2000' THEN 3000.00
        ELSE NULL
      END;
    END IF;

    IF v_parcela IS NULL AND r.dados_simulacao->>'valor_mensal_disponivel' IS NOT NULL THEN
      BEGIN
        v_parcela := (r.dados_simulacao->>'valor_mensal_disponivel')::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        v_parcela := NULL;
      END;
    END IF;

    -- Se ainda nulo e o valor estimado era <= 5000 e origem de evento/sorteio
    IF v_parcela IS NULL AND coalesce(r.valor_estimado, r.valor_simulado, 0) <= 5000 AND coalesce(r.valor_estimado, r.valor_simulado, 0) > 0 THEN
      v_parcela := coalesce(r.valor_estimado, r.valor_simulado);
    END IF;

    -- Se o valor_parcela já existia e for válido, preserva
    IF r.valor_parcela IS NOT NULL AND r.valor_parcela > 0 THEN
      v_parcela := r.valor_parcela;
    END IF;

    IF v_parcela IS NOT NULL THEN
      -- Se o valor_estimado era na verdade a parcela (<= 5000 ou igual à parcela calculada), limpa para NULL
      IF coalesce(r.valor_estimado, 0) <= 5000 OR coalesce(r.valor_estimado, 0) = v_parcela THEN
        UPDATE public.leads
        SET
          valor_parcela = v_parcela,
          valor_estimado = NULL,
          valor_credito = NULL,
          valor_simulado = CASE WHEN coalesce(valor_simulado, 0) <= 5000 THEN NULL ELSE valor_simulado END
        WHERE id = r.id;
      ELSE
        -- Mantém o crédito estimado se for valor real grande (> 5000) e grava a parcela
        UPDATE public.leads
        SET valor_parcela = v_parcela
        WHERE id = r.id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Passo 3: Atualizar rpc_realizar_checkin_conversacional para nunca mais gravar parcela em valor_estimado
CREATE OR REPLACE FUNCTION public.rpc_realizar_checkin_conversacional(
  p_evento_id UUID,
  p_nome TEXT,
  p_whatsapp TEXT,
  p_qualificacao JSONB DEFAULT '{}'::jsonb,
  p_qr_code_unico_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_digits TEXT;
  v_tel_norm TEXT;
  v_lead_id UUID;
  v_evento_rec RECORD;
  v_existente RECORD;
  v_capacidade TEXT;
  v_valor_mensal NUMERIC(15, 2);
  v_tipo_credito TEXT;
  v_novo_codigo TEXT;
  v_part_id UUID;
  v_sorteio_ativo BOOLEAN;
  v_max_seq INTEGER;
BEGIN
  -- 1. Normalização do telefone
  v_digits := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  IF length(v_digits) IN (12, 13) AND v_digits LIKE '55%' THEN
    v_tel_norm := substring(v_digits FROM 3);
  ELSE
    v_tel_norm := v_digits;
  END IF;

  IF length(v_tel_norm) < 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Telefone inválido (mínimo 10 dígitos com DDD).');
  END IF;

  -- 2. Validação do evento
  SELECT * INTO v_evento_rec
  FROM public.eventos
  WHERE id = p_evento_id;

  IF v_evento_rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Evento não encontrado.');
  END IF;

  -- 3. Lock transacional por evento + telefone
  PERFORM pg_advisory_xact_lock(hashtext('checkin_' || p_evento_id::text || '_' || v_tel_norm));

  -- 4. Verificar se já realizou check-in neste evento
  SELECT sp.id AS sorteio_part_id, sp.codigo, l.id AS lead_id, l.nome
  INTO v_existente
  FROM public.eventos_checkins c
  LEFT JOIN public.eventos_sorteio_participantes sp ON sp.id = c.sorteio_participante_id
  LEFT JOIN public.leads l ON l.id = c.lead_id
  WHERE c.evento_id = p_evento_id
    AND regexp_replace(coalesce(c.whatsapp, ''), '\D', '', 'g') LIKE '%' || v_tel_norm
  LIMIT 1;

  IF v_existente.lead_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'ja_cadastrado', true,
      'nome', v_existente.nome,
      'codigo', v_existente.codigo,
      'mensagem', 'Olá, ' || v_existente.nome || '! Sua presença já está confirmada.',
      'sorteio_participante_id', v_existente.sorteio_part_id
    );
  END IF;

  -- 5. Mapeamento da Qualificação Comercial para Lead CRM
  v_capacidade := coalesce(p_qualificacao->>'capacidade_mensal', '');
  v_valor_mensal := CASE
    WHEN v_capacidade = 'ate_500' THEN 500.00
    WHEN v_capacidade = '500_1000' THEN 1000.00
    WHEN v_capacidade = '1000_2000' THEN 2000.00
    WHEN v_capacidade = 'acima_2000' THEN 3000.00
    ELSE NULL
  END;

  v_tipo_credito := CASE
    WHEN p_qualificacao->>'veiculo' IN ('carro', 'moto', 'carro_moto') THEN 'Veículo'
    WHEN p_qualificacao->>'moradia' IN ('propria_financiada', 'aluguel') THEN 'Imóvel'
    ELSE 'Consórcio Geral'
  END;

  -- 6. Localizar ou Criar Lead Preservando Histórico
  SELECT id INTO v_lead_id
  FROM public.leads
  WHERE telefone_normalizado = v_tel_norm
     OR regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') = v_tel_norm
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_lead_id IS NOT NULL THEN
    -- Atualiza lead existente gravando valor_parcela (sem poluir colunas de crédito)
    UPDATE public.leads
    SET ultima_interacao_at = now(),
        updated_at = now(),
        evento_id = coalesce(evento_id, p_evento_id),
        evento_nome = coalesce(evento_nome, v_evento_rec.nome),
        valor_parcela = coalesce(v_valor_mensal, valor_parcela)
    WHERE id = v_lead_id;
  ELSE
    -- Cria novo lead no CRM: PARCELA MENSAL EM valor_parcela, CRÉDITO A DEFINIR (NULL)
    INSERT INTO public.leads (
      nome,
      whatsapp,
      telefone_normalizado,
      origem,
      origem_detalhe,
      evento_id,
      evento_nome,
      tipo_interesse,
      tipo_credito,
      valor_parcela,
      valor_estimado,
      valor_credito,
      valor_simulado,
      status,
      dados_simulacao,
      criado_manual
    )
    VALUES (
      p_nome,
      p_whatsapp,
      v_tel_norm,
      'evento_checkin',
      v_evento_rec.slug,
      p_evento_id,
      v_evento_rec.nome,
      v_tipo_credito,
      v_tipo_credito,
      v_valor_mensal,
      NULL,
      NULL,
      NULL,
      'Novo',
      jsonb_build_object(
        'origem', 'qr_checkin_conversacional',
        'evento_id', p_evento_id,
        'evento_nome', v_evento_rec.nome,
        'qualificacao', p_qualificacao,
        'qr_code_unico_id', p_qr_code_unico_id
      ),
      false
    )
    RETURNING id INTO v_lead_id;
  END IF;

  -- 7. Calcular Próximo Número Sequencial Seguro para Este Evento
  SELECT coalesce(max(
    CASE
      WHEN codigo ~ '^[0-9]+$' THEN codigo::integer
      ELSE 0
    END
  ), 0) + 1
  INTO v_max_seq
  FROM public.eventos_sorteio_participantes
  WHERE evento_id = p_evento_id;

  v_novo_codigo := lpad(v_max_seq::text, 4, '0');

  -- 8. Inserir participante do sorteio
  INSERT INTO public.eventos_sorteio_participantes (
    evento_id,
    nome,
    telefone,
    codigo,
    origem,
    dados_adicionais
  )
  VALUES (
    p_evento_id,
    p_nome,
    p_whatsapp,
    v_novo_codigo,
    'qr_checkin_conversacional',
    jsonb_build_object(
      'lead_id', v_lead_id,
      'qualificacao', p_qualificacao,
      'qr_code_unico_id', p_qr_code_unico_id
    )
  )
  RETURNING id INTO v_part_id;

  -- 9. Registrar check-in oficial
  INSERT INTO public.eventos_checkins (
    evento_id,
    lead_id,
    nome,
    whatsapp,
    origem,
    sorteio_participante_id,
    metadados
  )
  VALUES (
    p_evento_id,
    v_lead_id,
    p_nome,
    p_whatsapp,
    'qr_checkin_conversacional',
    v_part_id,
    jsonb_build_object(
      'qualificacao', p_qualificacao,
      'codigo_sorteio', v_novo_codigo,
      'qr_code_unico_id', p_qr_code_unico_id
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'ja_cadastrado', false,
    'nome', p_nome,
    'codigo', v_novo_codigo,
    'mensagem', 'Presença confirmada com sucesso! Seu número da sorte é ' || v_novo_codigo || '.',
    'sorteio_participante_id', v_part_id,
    'lead_id', v_lead_id
  );
END;
$$;

-- Passo 4: Atualizar rpc_upsert_lead_por_telefone para suportar e persistir valor_credito e valor_parcela
CREATE OR REPLACE FUNCTION public.rpc_upsert_lead_por_telefone(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_raw_tel TEXT;
  v_digits TEXT;
  v_tel_norm TEXT;
  v_lead_id UUID;
  v_action TEXT;
  v_nome TEXT;
  v_email TEXT;
  v_cidade TEXT;
  v_origem TEXT;
  v_origem_detalhe TEXT;
  v_tipo_interesse TEXT;
  v_produto_interesse TEXT;
  v_tipo_credito TEXT;
  v_valor_simulado NUMERIC;
  v_prazo_simulado INTEGER;
  v_entrada NUMERIC;
  v_renda NUMERIC;
  v_valor_estimado NUMERIC;
  v_valor_credito NUMERIC;
  v_valor_parcela NUMERIC;
  v_dados_simulacao JSONB;
  v_resultado_resumido TEXT;
  v_empresa_id UUID;
  v_parceiro_id UUID;
  v_imovel_id UUID;
  v_carta_id UUID;
  v_evento_id UUID;
  v_evento_nome TEXT;
  v_host_origem TEXT;
  v_pagina_origem TEXT;
  v_utm_source TEXT;
  v_utm_medium TEXT;
  v_utm_campaign TEXT;
  v_participante_comercial_id UUID;
  v_forcar_novo BOOLEAN;
  v_lead_rec RECORD;
  v_lead_ganho_rec RECORD;
  v_etapa_novo_id UUID;
  v_entry_date TEXT;
  v_origem_txt TEXT;
  v_tipo_inv TEXT;
  v_credito_txt TEXT;
  v_parcela_txt TEXT;
  v_entrada_txt TEXT;
  v_new_entry TEXT;
  v_new_entry_ganho TEXT;
  v_hist_consolidado TEXT;
  v_ultima_obs TEXT;
BEGIN
  -- 1. Normalização do telefone
  v_raw_tel := coalesce(p_payload->>'whatsapp', p_payload->>'telefone', '');
  v_digits := regexp_replace(v_raw_tel, '\D', '', 'g');
  IF length(v_digits) IN (12, 13) AND v_digits LIKE '55%' THEN
    v_tel_norm := substring(v_digits FROM 3);
  ELSE
    v_tel_norm := v_digits;
  END IF;

  IF length(v_tel_norm) < 10 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Telefone inválido para consolidação de lead (mínimo 10 dígitos com DDD).'
    );
  END IF;

  -- 2. Advisory Lock por telefone normalizado (impede concorrência)
  PERFORM pg_advisory_xact_lock(hashtext('lead_upsert_' || v_tel_norm));

  -- 3. Extração dos campos
  v_nome := nullif(trim(coalesce(p_payload->>'nome', '')), '');
  v_email := nullif(trim(lower(coalesce(p_payload->>'email', ''))), '');
  v_cidade := nullif(trim(coalesce(p_payload->>'cidade', '')), '');
  v_origem := nullif(trim(coalesce(p_payload->>'origem', '')), '');
  v_origem_detalhe := nullif(trim(coalesce(p_payload->>'origem_detalhe', '')), '');
  v_tipo_interesse := nullif(trim(coalesce(p_payload->>'tipo_interesse', '')), '');
  v_produto_interesse := nullif(trim(coalesce(p_payload->>'produto_interesse', '')), '');
  v_tipo_credito := nullif(trim(coalesce(p_payload->>'tipo_credito', '')), '');
  v_valor_simulado := nullif(p_payload->>'valor_simulado', '')::numeric;
  v_prazo_simulado := nullif(p_payload->>'prazo_simulado', '')::integer;
  v_entrada := nullif(p_payload->>'entrada', '')::numeric;
  v_renda := nullif(p_payload->>'renda', '')::numeric;

  -- Valor do Crédito Pretendido: explicitamente informado como valor_credito ou valor_estimado
  v_valor_credito := nullif(coalesce(p_payload->>'valor_credito', p_payload->>'valor_estimado'), '')::numeric;
  v_valor_estimado := v_valor_credito;

  -- Valor da Parcela Mensal Pretendida
  v_valor_parcela := nullif(p_payload->>'valor_parcela', '')::numeric;
  IF v_valor_parcela IS NULL AND p_payload->>'capacidade_mensal' IS NOT NULL THEN
    v_valor_parcela := CASE
      WHEN p_payload->>'capacidade_mensal' = 'ate_500' THEN 500.00
      WHEN p_payload->>'capacidade_mensal' = '500_1000' THEN 1000.00
      WHEN p_payload->>'capacidade_mensal' = '1000_2000' THEN 2000.00
      WHEN p_payload->>'capacidade_mensal' = 'acima_2000' THEN 3000.00
      ELSE NULL
    END;
  END IF;

  v_dados_simulacao := p_payload->'dados_simulacao';
  v_resultado_resumido := nullif(trim(coalesce(p_payload->>'resultado_resumido', '')), '');
  v_empresa_id := nullif(p_payload->>'empresa_id', '')::uuid;
  v_parceiro_id := nullif(p_payload->>'parceiro_id', '')::uuid;
  v_imovel_id := nullif(p_payload->>'imovel_id', '')::uuid;
  v_carta_id := nullif(p_payload->>'carta_contemplada_id', '')::uuid;
  v_evento_id := nullif(p_payload->>'evento_id', '')::uuid;
  v_evento_nome := nullif(trim(coalesce(p_payload->>'evento_nome', '')), '');
  v_host_origem := nullif(trim(coalesce(p_payload->>'host_origem', '')), '');
  v_pagina_origem := nullif(trim(coalesce(p_payload->>'pagina_origem', '')), '');
  v_utm_source := nullif(trim(coalesce(p_payload->>'utm_source', '')), '');
  v_utm_medium := nullif(trim(coalesce(p_payload->>'utm_medium', '')), '');
  v_utm_campaign := nullif(trim(coalesce(p_payload->>'utm_campaign', '')), '');
  v_participante_comercial_id := nullif(p_payload->>'participante_comercial_id', '')::uuid;
  v_forcar_novo := coalesce((p_payload->>'permitir_gerar_novo')::boolean, (p_payload->>'forcar_novo')::boolean, false);
  v_ultima_obs := nullif(trim(coalesce(p_payload->>'observacoes', '')), '');

  -- 4. Construção do bloco de histórico formatado com data na frente (America/Cuiaba)
  v_entry_date := to_char(now() at time zone 'America/Cuiaba', 'DD/MM/YYYY HH24:MI');
  v_origem_txt := coalesce(v_evento_nome, v_origem_detalhe, v_origem, 'Novo contato');
  v_tipo_inv := coalesce(v_produto_interesse, v_tipo_interesse, v_tipo_credito);

  IF coalesce(v_valor_credito, v_valor_simulado) IS NOT NULL AND coalesce(v_valor_credito, v_valor_simulado) > 5000 THEN
    v_credito_txt := 'R$ ' || trim(to_char(coalesce(v_valor_credito, v_valor_simulado), 'FM999G999G990D00'));
  END IF;

  IF v_valor_parcela IS NOT NULL AND v_valor_parcela > 0 THEN
    v_parcela_txt := 'R$ ' || trim(to_char(v_valor_parcela, 'FM999G999G990D00')) || '/mês';
  ELSIF p_payload->>'capacidade_mensal' IS NOT NULL AND trim(p_payload->>'capacidade_mensal') != '' THEN
    v_parcela_txt := p_payload->>'capacidade_mensal';
  END IF;

  IF v_entrada IS NOT NULL AND v_entrada > 0 THEN
    v_entrada_txt := 'R$ ' || trim(to_char(v_entrada, 'FM999G999G990D00'));
  END IF;

  v_new_entry := '[' || v_entry_date || '] Nova abordagem / cadastro (' || v_origem_txt || '):';
  IF v_evento_nome IS NOT NULL THEN
    v_new_entry := v_new_entry || E'\n• Evento: ' || v_evento_nome;
  END IF;
  IF v_tipo_inv IS NOT NULL THEN
    v_new_entry := v_new_entry || E'\n• Tipo de investimento / interesse: ' || v_tipo_inv;
  END IF;
  IF v_credito_txt IS NOT NULL THEN
    v_new_entry := v_new_entry || E'\n• Crédito pretendido: ' || v_credito_txt;
  END IF;
  IF v_parcela_txt IS NOT NULL THEN
    v_new_entry := v_new_entry || E'\n• Parcela mensal pretendida: ' || v_parcela_txt;
  END IF;
  IF v_entrada_txt IS NOT NULL THEN
    v_new_entry := v_new_entry || E'\n• Entrada disponível: ' || v_entrada_txt;
  END IF;
  IF v_prazo_simulado IS NOT NULL AND v_prazo_simulado > 0 THEN
    v_new_entry := v_new_entry || E'\n• Prazo pretendido: ' || v_prazo_simulado || ' meses';
  END IF;
  IF v_cidade IS NOT NULL THEN
    v_new_entry := v_new_entry || E'\n• Cidade: ' || v_cidade;
  END IF;
  IF v_ultima_obs IS NOT NULL THEN
    v_new_entry := v_new_entry || E'\n• Observações: ' || v_ultima_obs;
  END IF;

  -- 5. Busca se existe lead ABERTO / EM ANDAMENTO (não ganho) para este telefone
  IF NOT v_forcar_novo THEN
    SELECT l.*
    INTO v_lead_rec
    FROM public.leads l
    LEFT JOIN public.crm_funil_etapas fe ON fe.id = l.etapa_id
    WHERE (l.telefone_normalizado = v_tel_norm
       OR regexp_replace(coalesce(l.whatsapp, ''), '\D', '', 'g') = v_tel_norm)
      AND (v_empresa_id IS NULL OR l.empresa_id = v_empresa_id)
      AND coalesce(fe.is_won, false) = false
      AND lower(coalesce(l.status, '')) NOT IN ('fechado', 'ganho', 'venda fechada', 'venda_fechada')
    ORDER BY l.created_at DESC
    LIMIT 1;
  END IF;

  -- CASO 1: Lead em andamento encontrado -> NUNCA DUPLICA. Move para 'Novo lead' e acumula histórico
  IF v_lead_rec.id IS NOT NULL THEN
    v_lead_id := v_lead_rec.id;
    v_action := 'updated';

    -- Resolver etapa 'novo_lead' da empresa
    SELECT id INTO v_etapa_novo_id
    FROM public.crm_funil_etapas
    WHERE empresa_id = coalesce(v_empresa_id, v_lead_rec.empresa_id)
      AND slug = 'novo_lead'
    LIMIT 1;

    UPDATE public.leads
    SET
      nome = CASE
        WHEN (v_lead_rec.nome IS NULL OR trim(v_lead_rec.nome) = '' OR lower(v_lead_rec.nome) = 'teste') AND v_nome IS NOT NULL THEN v_nome
        ELSE coalesce(v_lead_rec.nome, v_nome)
      END,
      email = coalesce(v_lead_rec.email, v_email),
      cidade = coalesce(v_lead_rec.cidade, v_cidade),
      whatsapp = coalesce(v_lead_rec.whatsapp, v_raw_tel),
      telefone_normalizado = v_tel_norm,
      status = 'Novo',
      etapa_id = coalesce(v_etapa_novo_id, v_lead_rec.etapa_id),
      fechado = false,
      perdido_at = null,
      valor_credito = coalesce(v_valor_credito, v_lead_rec.valor_credito),
      valor_estimado = coalesce(v_valor_estimado, v_valor_credito, v_lead_rec.valor_estimado),
      valor_simulado = coalesce(v_valor_simulado, v_lead_rec.valor_simulado),
      valor_parcela = coalesce(v_valor_parcela, v_lead_rec.valor_parcela),
      prazo_simulado = coalesce(v_prazo_simulado, v_lead_rec.prazo_simulado),
      entrada = coalesce(v_entrada, v_lead_rec.entrada),
      renda = coalesce(v_renda, v_lead_rec.renda),
      tipo_interesse = coalesce(v_tipo_interesse, v_lead_rec.tipo_interesse),
      produto_interesse = coalesce(v_produto_interesse, v_lead_rec.produto_interesse),
      tipo_credito = coalesce(v_tipo_credito, v_lead_rec.tipo_credito),
      dados_simulacao = coalesce(v_dados_simulacao, v_lead_rec.dados_simulacao),
      resultado_resumido = coalesce(v_resultado_resumido, v_lead_rec.resultado_resumido),
      origem_detalhe = CASE
        WHEN v_origem_detalhe IS NOT NULL THEN v_origem_detalhe
        ELSE v_lead_rec.origem_detalhe
      END,
      evento_id = coalesce(v_evento_id, v_lead_rec.evento_id),
      evento_nome = coalesce(v_evento_nome, v_lead_rec.evento_nome),
      imovel_id = coalesce(v_imovel_id, v_lead_rec.imovel_id),
      carta_contemplada_id = coalesce(v_carta_id, v_lead_rec.carta_contemplada_id),
      empresa_id = coalesce(v_lead_rec.empresa_id, v_empresa_id),
      parceiro_id = coalesce(v_lead_rec.parceiro_id, v_parceiro_id),
      participante_comercial_id = coalesce(v_lead_rec.participante_comercial_id, v_participante_comercial_id),
      host_origem = coalesce(v_lead_rec.host_origem, v_host_origem),
      pagina_origem = coalesce(v_lead_rec.pagina_origem, v_pagina_origem),
      utm_source = coalesce(v_lead_rec.utm_source, v_utm_source),
      utm_medium = coalesce(v_lead_rec.utm_medium, v_utm_medium),
      utm_campaign = coalesce(v_lead_rec.utm_campaign, v_utm_campaign),
      historico_cadastros = CASE
        WHEN v_lead_rec.historico_cadastros IS NOT NULL AND trim(v_lead_rec.historico_cadastros) != ''
          THEN v_new_entry || E'\n\n---\n\n' || v_lead_rec.historico_cadastros
        ELSE v_new_entry
      END,
      observacoes = coalesce(v_ultima_obs, v_new_entry),
      ultima_interacao_at = now(),
      data_ultimo_contato = now(),
      updated_at = now()
    WHERE id = v_lead_id;

    INSERT INTO public.leads_historico (
      lead_id,
      acao,
      descricao,
      dados_novos
    ) VALUES (
      v_lead_id,
      'lead_recorrente_unificado',
      'Lead reabordado / unificado pelo telefone (' || v_origem_txt || ') - Reposicionado na etapa Novo lead',
      p_payload
    );

  ELSE
    -- CASO 2: Lead ativo NÃO encontrado. Verifica se existe lead GANHO / FECHADO
    SELECT l.*
    INTO v_lead_ganho_rec
    FROM public.leads l
    LEFT JOIN public.crm_funil_etapas fe ON fe.id = l.etapa_id
    WHERE (l.telefone_normalizado = v_tel_norm
       OR regexp_replace(coalesce(l.whatsapp, ''), '\D', '', 'g') = v_tel_norm)
      AND (v_empresa_id IS NULL OR l.empresa_id = v_empresa_id)
      AND (coalesce(fe.is_won, false) = true OR lower(coalesce(l.status, '')) IN ('fechado', 'ganho', 'venda fechada', 'venda_fechada'))
    ORDER BY l.created_at DESC
    LIMIT 1;

    IF v_lead_ganho_rec.id IS NOT NULL THEN
      -- Cliente já converteu anteriormente: PODE DUPLICAR -> GERA UMA NOVA NEGOCIAÇÃO (CÓPIA NOVO LEAD)
      v_action := 'copied_new_deal';

      SELECT id INTO v_etapa_novo_id
      FROM public.crm_funil_etapas
      WHERE empresa_id = coalesce(v_empresa_id, v_lead_ganho_rec.empresa_id)
        AND slug = 'novo_lead'
      LIMIT 1;

      v_new_entry_ganho := '[' || v_entry_date || E'] 🌟 NOVA NEGOCIAÇÃO (Cliente com venda anterior ganha - Ref #' || substring(v_lead_ganho_rec.id::text from 1 for 8) || E'):\n' || v_new_entry;

      v_hist_consolidado := v_new_entry_ganho;
      IF v_lead_ganho_rec.historico_cadastros IS NOT NULL AND trim(v_lead_ganho_rec.historico_cadastros) != '' THEN
        v_hist_consolidado := v_hist_consolidado || E'\n\n---\n[Histórico Consolidado da Negociação Anterior]:\n' || v_lead_ganho_rec.historico_cadastros;
      ELSIF v_lead_ganho_rec.observacoes IS NOT NULL AND trim(v_lead_ganho_rec.observacoes) != '' THEN
        v_hist_consolidado := v_hist_consolidado || E'\n\n---\n[Histórico Consolidado da Negociação Anterior]:\n' || v_lead_ganho_rec.observacoes;
      END IF;

      INSERT INTO public.leads (
        empresa_id,
        nome,
        whatsapp,
        telefone_normalizado,
        email,
        cidade,
        origem,
        origem_detalhe,
        tipo_interesse,
        produto_interesse,
        tipo_credito,
        valor_credito,
        valor_estimado,
        valor_simulado,
        valor_parcela,
        prazo_simulado,
        entrada,
        renda,
        dados_simulacao,
        resultado_resumido,
        status,
        etapa_id,
        srd_responsavel_id,
        srd_responsavel_nome,
        temperatura,
        modelo_interesse,
        proxima_acao,
        historico_cadastros,
        observacoes,
        ultima_interacao_at,
        data_ultimo_contato,
        criado_manual
      ) VALUES (
        coalesce(v_empresa_id, v_lead_ganho_rec.empresa_id),
        coalesce(v_nome, v_lead_ganho_rec.nome, 'Contato sem nome'),
        coalesce(v_raw_tel, v_lead_ganho_rec.whatsapp),
        v_tel_norm,
        coalesce(v_email, v_lead_ganho_rec.email),
        coalesce(v_cidade, v_lead_ganho_rec.cidade),
        coalesce(v_origem, 'recorrente'),
        coalesce(v_origem_detalhe, 'Nova negociação de cliente ganho'),
        coalesce(v_tipo_interesse, v_lead_ganho_rec.tipo_interesse),
        coalesce(v_produto_interesse, v_lead_ganho_rec.produto_interesse),
        coalesce(v_tipo_credito, v_lead_ganho_rec.tipo_credito),
        v_valor_credito,
        coalesce(v_valor_estimado, v_valor_simulado, v_lead_ganho_rec.valor_estimado),
        v_valor_simulado,
        v_valor_parcela,
        v_prazo_simulado,
        v_entrada,
        v_renda,
        v_dados_simulacao,
        v_resultado_resumido,
        'Novo',
        v_etapa_novo_id,
        v_lead_ganho_rec.srd_responsavel_id,
        v_lead_ganho_rec.srd_responsavel_nome,
        'Quente',
        coalesce(p_payload->>'modelo_interesse', v_lead_ganho_rec.modelo_interesse, 'CLIENTE_FINAL'),
        'Fazer contato - Cliente recorrente (Venda Ganha Anterior)',
        v_hist_consolidado,
        coalesce(v_ultima_obs, v_new_entry_ganho),
        now(),
        now(),
        false
      )
      RETURNING id INTO v_lead_id;

      INSERT INTO public.leads_historico (
        lead_id,
        acao,
        descricao,
        dados_novos
      ) VALUES (
        v_lead_id,
        'nova_negociacao_cliente_ganho',
        'Nova negociação gerada automaticamente para cliente com histórico de venda ganha (Ref: ' || v_lead_ganho_rec.id || ')',
        jsonb_build_object('lead_origem_ganho_id', v_lead_ganho_rec.id, 'origem', v_origem_txt)
      );

    ELSE
      -- CASO 3: Lead inédito -> Insere normalmente na etapa 'Novo lead'
      v_action := 'created';

      SELECT id INTO v_etapa_novo_id
      FROM public.crm_funil_etapas
      WHERE empresa_id = v_empresa_id
        AND slug = 'novo_lead'
      LIMIT 1;

      INSERT INTO public.leads (
        nome,
        whatsapp,
        telefone_normalizado,
        email,
        cidade,
        origem,
        origem_detalhe,
        tipo_interesse,
        produto_interesse,
        tipo_credito,
        valor_credito,
        valor_estimado,
        valor_simulado,
        valor_parcela,
        prazo_simulado,
        entrada,
        renda,
        dados_simulacao,
        resultado_resumido,
        status,
        empresa_id,
        parceiro_id,
        imovel_id,
        carta_contemplada_id,
        evento_id,
        evento_nome,
        host_origem,
        pagina_origem,
        utm_source,
        utm_medium,
        utm_campaign,
        participante_comercial_id,
        historico_cadastros,
        observacoes,
        etapa_id,
        srd_responsavel_id,
        srd_responsavel_nome,
        temperatura,
        modelo_interesse,
        proxima_acao,
        ultima_interacao_at,
        data_ultimo_contato,
        criado_manual
      ) VALUES (
        coalesce(v_nome, 'Contato sem nome'),
        v_raw_tel,
        v_tel_norm,
        v_email,
        v_cidade,
        coalesce(v_origem, 'site'),
        v_origem_detalhe,
        v_tipo_interesse,
        v_produto_interesse,
        v_tipo_credito,
        v_valor_credito,
        v_valor_estimado,
        v_valor_simulado,
        v_valor_parcela,
        v_prazo_simulado,
        v_entrada,
        v_renda,
        v_dados_simulacao,
        v_resultado_resumido,
        'Novo',
        v_empresa_id,
        v_parceiro_id,
        v_imovel_id,
        v_carta_id,
        v_evento_id,
        v_evento_nome,
        v_host_origem,
        v_pagina_origem,
        v_utm_source,
        v_utm_medium,
        v_utm_campaign,
        v_participante_comercial_id,
        v_new_entry,
        coalesce(v_ultima_obs, v_new_entry),
        coalesce(v_etapa_novo_id, (p_payload->>'etapa_id')::uuid),
        (p_payload->>'srd_responsavel_id')::uuid,
        v_lead_rec.srd_responsavel_nome,
        coalesce(p_payload->>'temperatura', 'Morno'),
        coalesce(p_payload->>'modelo_interesse', 'CLIENTE_FINAL'),
        coalesce(p_payload->>'proxima_acao', 'Fazer primeiro contato'),
        now(),
        now(),
        coalesce((p_payload->>'criado_manual')::boolean, false)
      )
      RETURNING id INTO v_lead_id;

      INSERT INTO public.leads_historico (
        lead_id,
        acao,
        descricao,
        dados_novos
      ) VALUES (
        v_lead_id,
        'lead_criado',
        'Lead criado via ' || v_origem_txt,
        p_payload
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'action', v_action,
    'lead_id', v_lead_id,
    'telefone_normalizado', v_tel_norm,
    'lead_origem_ganho_id', v_lead_ganho_rec.id
  );
END;
$$;
