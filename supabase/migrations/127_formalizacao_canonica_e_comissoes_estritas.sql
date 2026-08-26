-- 127: Formalização canônica e motor de comissões estrito.
-- Recupera com segurança bancos que receberam a antiga migration 102 manualmente.
BEGIN;

-- 1. Garantir defaults seguros e colunas em comissao_previsoes_participantes
ALTER TABLE public.comissao_previsoes_participantes ADD COLUMN IF NOT EXISTS papel_tipo text;
ALTER TABLE public.comissao_previsoes_participantes ADD COLUMN IF NOT EXISTS previsao_franquia_id uuid;
ALTER TABLE public.comissao_previsoes_participantes ADD COLUMN IF NOT EXISTS valor_fixo_aplicado numeric(15,2);
ALTER TABLE public.comissao_previsoes_participantes ALTER COLUMN base_calculo_valor SET DEFAULT 0;
ALTER TABLE public.comissao_previsoes_participantes ALTER COLUMN nome_etapa SET DEFAULT 'Parcela Única';
ALTER TABLE public.comissao_previsoes_participantes ALTER COLUMN percentual_aplicado SET DEFAULT 0;
ALTER TABLE public.comissao_previsoes_participantes ALTER COLUMN valor_previsto SET DEFAULT 0;

-- 2. Garantir defaults seguros e colunas em comissao_previsoes_franquia
ALTER TABLE public.comissao_previsoes_franquia ALTER COLUMN base_calculo_valor SET DEFAULT 0;
ALTER TABLE public.comissao_previsoes_franquia ALTER COLUMN nome_etapa SET DEFAULT 'Parcela Única';
ALTER TABLE public.comissao_previsoes_franquia ALTER COLUMN percentual_aplicado SET DEFAULT 0;
ALTER TABLE public.comissao_previsoes_franquia ALTER COLUMN valor_previsto SET DEFAULT 0;

-- 3. Atualizar rpc_gerar_previsoes_comissao_v2 com todos os campos obrigatórios
CREATE OR REPLACE FUNCTION public.rpc_gerar_previsoes_comissao_v2(
  p_empresa_id uuid,
  p_venda_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_venda record;
  v_cota record;
  v_grupo record;
  v_regra record;
  v_etapa record;
  v_imposto numeric := 0;
  v_bruto numeric;
  v_tax numeric;
  v_liquido numeric;
  v_comp text;
  v_result jsonb;
  v_prev_id uuid;
  v_percentual numeric;
  v_etapas_count integer := 0;
  v_data_base_1 date;
  v_data_base_2 date;
  v_mes_data date;
  v_ordem_idx integer;

  -- Variáveis de Participantes e Perfis
  v_principal_id uuid;
  v_secundario_id uuid;
  v_fracao_secundario numeric;
  v_perfil_principal_id uuid;
  v_perfil_secundario_id uuid;
  v_programa_principal_id uuid;
  v_percentual_principal numeric;
  v_valor_principal_bruto numeric;
  v_valor_secundario numeric := 0;
  v_valor_principal_liquido numeric;
  v_modo_cronograma_sec text := 'SEGUIR_PRINCIPAL';
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text || ':GERACAO_PREVISOES_V2:' || p_idempotency_key, 0));

  SELECT * INTO v_venda FROM public.vendas WHERE id = p_venda_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF v_venda.id IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada no tenant';
  END IF;

  SELECT * INTO v_cota FROM public.cotas_definitivas WHERE venda_id = p_venda_id;
  SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id = v_venda.grupo_id;

  -- Limpar previsões anteriores se for recálculo
  DELETE FROM public.comissao_previsoes_participantes WHERE venda_id = p_venda_id;
  DELETE FROM public.comissao_previsoes_franquia WHERE venda_id = p_venda_id;

  -- Resolução de datas de comissão
  v_data_base_1 := COALESCE(
    v_venda.data_primeira_parcela,
    (v_venda.snapshot_venda->>'data_primeira_parcela')::date,
    (v_venda.snapshot_venda#>>'{dados_simulacao,data_primeira_parcela}')::date,
    v_venda.data_venda::date,
    CURRENT_DATE
  );

  v_data_base_2 := COALESCE(
    v_venda.data_segunda_parcela,
    (v_venda.snapshot_venda->>'data_segunda_parcela')::date,
    (v_venda.snapshot_venda#>>'{dados_simulacao,data_segunda_parcela}')::date,
    (v_data_base_1 + INTERVAL '1 month')::date
  );

  -- Identificação de participantes e perfis
  v_principal_id := COALESCE(
    v_venda.participante_comercial_id,
    (v_venda.snapshot_venda->>'participante_comercial_id')::uuid,
    (v_venda.snapshot_venda#>>'{dados_simulacao,participante_principal_id}')::uuid
  );

  v_secundario_id := COALESCE(
    v_venda.participante_secundario_id,
    (v_venda.snapshot_venda->>'participante_secundario_id')::uuid,
    (v_venda.snapshot_venda#>>'{dados_simulacao,participante_secundario_id}')::uuid
  );

  v_fracao_secundario := COALESCE(
    v_venda.participante_secundario_fracao_percentual,
    (v_venda.snapshot_venda->>'fracao_secundario')::numeric,
    (v_venda.snapshot_venda#>>'{dados_simulacao,fracao_secundario}')::numeric,
    0
  );

  v_perfil_principal_id := COALESCE(
    v_venda.perfil_principal_id,
    (v_venda.snapshot_venda->>'perfil_principal_id')::uuid,
    (v_venda.snapshot_venda#>>'{dados_simulacao,perfil_principal_id}')::uuid
  );

  v_perfil_secundario_id := COALESCE(
    v_venda.perfil_secundario_id,
    (v_venda.snapshot_venda->>'perfil_secundario_id')::uuid,
    (v_venda.snapshot_venda#>>'{dados_simulacao,perfil_secundario_id}')::uuid
  );

  v_modo_cronograma_sec := COALESCE(
    (v_venda.snapshot_venda->>'cronograma_secundario'),
    (v_venda.snapshot_venda#>>'{dados_simulacao,cronograma_secundario}'),
    'SEGUIR_PRINCIPAL'
  );

  -- 0. Busca programa_id e percentual configurado na regra do perfil do consultor
  IF v_perfil_principal_id IS NOT NULL THEN
    SELECT r.programa_id, r.percentual_comissao
    INTO v_programa_principal_id, v_percentual_principal
    FROM public.comissao_regras_participantes r
    WHERE r.perfil_id = v_perfil_principal_id
      AND r.empresa_id = p_empresa_id
      AND r.ativa
      AND r.configuracao_homologada
      AND r.status = 'HOMOLOGADA'
      AND r.vigencia_inicio <= v_venda.data_venda::date
      AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= v_venda.data_venda::date)
    ORDER BY r.versao DESC LIMIT 1;
  END IF;

  -- Se principal tem override em participante_comissao_perfis
  IF v_principal_id IS NOT NULL THEN
    SELECT COALESCE(
      (SELECT override_percentual FROM public.participante_comissao_perfis WHERE empresa_id = p_empresa_id AND participante_id = v_principal_id AND (perfil_id = v_perfil_principal_id OR v_perfil_principal_id IS NULL) AND ativo AND override_percentual IS NOT NULL LIMIT 1),
      v_percentual_principal
    ) INTO v_percentual_principal;
  END IF;

  -- 1. Busca Regra da Franqueadora vinculada ao programa do perfil (ex: Franquia Antiga v1 -> 2%)
  IF v_programa_principal_id IS NOT NULL THEN
    SELECT r.*, p.nome as programa_nome INTO v_regra
    FROM public.comissao_regras_franquia r
    JOIN public.comissao_programas p ON p.id = r.programa_id
    WHERE r.programa_id = v_programa_principal_id
      AND r.empresa_id = p_empresa_id
      AND r.ativa
      AND r.configuracao_homologada
      AND r.modalidade_comissao_id = v_venda.modalidade_comissao_id
      AND (r.tipo_administradora_id IS NULL OR r.tipo_administradora_id = v_grupo.tipo_administradora_id)
      AND r.vigencia_inicio <= v_venda.data_venda::date
      AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= v_venda.data_venda::date)
    ORDER BY
      (r.modalidade_comissao_id IS NOT NULL AND r.modalidade_comissao_id = v_venda.modalidade_comissao_id) DESC,
      (r.tipo_administradora_id IS NOT NULL AND r.tipo_administradora_id = v_grupo.tipo_administradora_id) DESC,
      r.versao DESC
    LIMIT 1;
  END IF;

  IF v_programa_principal_id IS NULL OR v_percentual_principal IS NULL THEN
    RAISE EXCEPTION 'Perfil principal sem regra de repasse homologada e vigente';
  END IF;
  IF v_regra.id IS NULL THEN
    RAISE EXCEPTION 'Regra da franqueadora não encontrada para programa, tipo e modalidade selecionados';
  END IF;

  -- Alíquota fiscal
  SELECT f.percentual_imposto INTO v_imposto
  FROM public.empresa_configuracoes_fiscais f
  WHERE f.empresa_id = p_empresa_id AND f.ativo AND f.vigencia_inicio <= v_venda.data_venda::date
    AND (f.vigencia_fim IS NULL OR f.vigencia_fim >= v_venda.data_venda::date)
  ORDER BY f.vigencia_inicio DESC LIMIT 1;
  v_imposto := COALESCE(v_imposto, 0);

  v_percentual := v_regra.percentual_total_comissao;
  IF v_percentual IS NULL OR v_percentual <= 0 THEN
    RAISE EXCEPTION 'Regra da franqueadora sem percentual homologado';
  END IF;

  IF v_regra.id IS NOT NULL THEN
    SELECT count(*) INTO v_etapas_count FROM public.comissao_regra_etapas WHERE regra_franquia_id = v_regra.id;

    IF v_etapas_count > 0 THEN
      v_ordem_idx := 0;
      FOR v_etapa IN
        SELECT * FROM public.comissao_regra_etapas
        WHERE regra_franquia_id = v_regra.id
        ORDER BY ordem ASC
      LOOP
        v_ordem_idx := v_ordem_idx + 1;
        IF v_etapa.ordem = 1 OR v_ordem_idx = 1 THEN
          v_comp := to_char(v_data_base_1, 'YYYY-MM');
        ELSE
          v_mes_data := (v_data_base_2 + ((v_ordem_idx - 2) || ' month')::interval)::date;
          v_comp := to_char(v_mes_data, 'YYYY-MM');
        END IF;

        v_bruto := round(v_venda.valor_credito * (v_etapa.percentual_venda / 100.0), 2);
        v_tax := round(v_bruto * (v_imposto / 100.0), 2);
        v_liquido := v_bruto - v_tax;

        INSERT INTO public.comissao_previsoes_franquia (
          empresa_id, venda_id, cota_definitiva_id, administradora_id, regra_franquia_id,
          ordem_etapa, nome_etapa, competencia, base_calculo_valor, percentual_aplicado,
          valor_previsto, status, snapshot_regra
        ) VALUES (
          p_empresa_id, p_venda_id, v_cota.id, v_venda.administradora_id, v_regra.id,
          v_etapa.ordem, COALESCE(v_etapa.nome, v_etapa.ordem || 'ª Parcela'), v_comp, v_venda.valor_credito, v_etapa.percentual_venda,
          v_bruto, 'prevista',
          jsonb_build_object(
            'imposto_aliquota', v_imposto,
            'imposto_valor', v_tax,
            'valor_liquido', v_liquido,
            'programa_nome', v_regra.programa_nome,
            'regra_id', v_regra.id,
            'origem', 'cronograma_etapas_v2'
          )
        ) RETURNING id INTO v_prev_id;

        -- Previsão do Consultor Principal e SDR para esta etapa
        IF v_principal_id IS NOT NULL THEN
          v_valor_principal_bruto := round(v_bruto * (v_percentual_principal / 100.0), 2);

          IF v_secundario_id IS NOT NULL AND v_fracao_secundario > 0 THEN
            v_valor_secundario := round(v_valor_principal_bruto * (v_fracao_secundario / 100.0), 2);
          ELSE
            v_valor_secundario := 0;
          END IF;

          v_valor_principal_liquido := v_valor_principal_bruto - v_valor_secundario;

          -- Insere previsão do Consultor Principal com base_calculo_valor explícito
          INSERT INTO public.comissao_previsoes_participantes (
            empresa_id, venda_id, cota_definitiva_id, participante_comercial_id, papel_tipo,
            previsao_franquia_id, ordem_etapa, nome_etapa, competencia, base_calculo_valor,
            percentual_aplicado, valor_previsto, status, snapshot_regra
          ) VALUES (
            p_empresa_id, p_venda_id, v_cota.id, v_principal_id, 'CONSULTOR',
            v_prev_id, v_etapa.ordem, COALESCE(v_etapa.nome, v_etapa.ordem || 'ª Parcela'), v_comp, v_bruto,
            v_percentual_principal, v_valor_principal_liquido, 'prevista',
            jsonb_build_object(
              'fracao_secundario_deduzida', v_fracao_secundario,
              'valor_bruto_antes_split', v_valor_principal_bruto,
              'secundario_id', v_secundario_id,
              'perfil_principal_id', v_perfil_principal_id,
              'reparticao_comercial', 'aplicada'
            )
          );

          -- Insere previsão do Participante Secundário (SDR) com base_calculo_valor explícito
          IF v_secundario_id IS NOT NULL AND v_valor_secundario > 0 THEN
            INSERT INTO public.comissao_previsoes_participantes (
              empresa_id, venda_id, cota_definitiva_id, participante_comercial_id, papel_tipo,
              previsao_franquia_id, ordem_etapa, nome_etapa, competencia, base_calculo_valor,
              percentual_aplicado, valor_previsto, status, snapshot_regra
            ) VALUES (
              p_empresa_id, p_venda_id, v_cota.id, v_secundario_id, 'SDR',
              v_prev_id, v_etapa.ordem, COALESCE(v_etapa.nome, v_etapa.ordem || 'ª Parcela') || ' (SDR)', v_comp, v_valor_principal_bruto,
              v_fracao_secundario, v_valor_secundario, 'prevista',
              jsonb_build_object(
                'fracao_sobre_principal', v_fracao_secundario,
                'principal_id', v_principal_id,
                'modo_cronograma', v_modo_cronograma_sec,
                'perfil_secundario_id', v_perfil_secundario_id,
                'reparticao_comercial', 'aplicada'
              )
            );
          END IF;
        END IF;
      END LOOP;
    ELSE
      -- Fallback 1 Etapa com o percentual da regra
      v_comp := to_char(v_data_base_1, 'YYYY-MM');
      v_bruto := round(v_venda.valor_credito * (v_percentual / 100.0), 2);
      v_tax := round(v_bruto * (v_imposto / 100.0), 2);
      v_liquido := v_bruto - v_tax;

      INSERT INTO public.comissao_previsoes_franquia (
        empresa_id, venda_id, cota_definitiva_id, administradora_id, regra_franquia_id,
        ordem_etapa, nome_etapa, competencia, base_calculo_valor, percentual_aplicado,
        valor_previsto, status, snapshot_regra
      ) VALUES (
        p_empresa_id, p_venda_id, v_cota.id, v_venda.administradora_id, v_regra.id,
        1, 'Comissão Única (100%)', v_comp, v_venda.valor_credito, v_percentual,
        v_bruto, 'prevista',
        jsonb_build_object(
          'imposto_aliquota', v_imposto,
          'imposto_valor', v_tax,
          'valor_liquido', v_liquido,
          'programa_nome', v_regra.programa_nome,
          'origem', 'fallback_unica_v2'
        )
      ) RETURNING id INTO v_prev_id;

      IF v_principal_id IS NOT NULL THEN
        v_valor_principal_bruto := round(v_bruto * (v_percentual_principal / 100.0), 2);
        IF v_secundario_id IS NOT NULL AND v_fracao_secundario > 0 THEN
          v_valor_secundario := round(v_valor_principal_bruto * (v_fracao_secundario / 100.0), 2);
        ELSE
          v_valor_secundario := 0;
        END IF;
        v_valor_principal_liquido := v_valor_principal_bruto - v_valor_secundario;

        INSERT INTO public.comissao_previsoes_participantes (
          empresa_id, venda_id, cota_definitiva_id, participante_comercial_id, papel_tipo,
          previsao_franquia_id, ordem_etapa, nome_etapa, competencia, base_calculo_valor,
          percentual_aplicado, valor_previsto, status, snapshot_regra
        ) VALUES (
          p_empresa_id, p_venda_id, v_cota.id, v_principal_id, 'CONSULTOR',
          v_prev_id, 1, 'Comissão Única (100%)', v_comp, v_bruto,
          v_percentual_principal, v_valor_principal_liquido, 'prevista',
          jsonb_build_object('fracao_secundario_deduzida', v_fracao_secundario, 'perfil_principal_id', v_perfil_principal_id, 'reparticao_comercial', 'aplicada')
        );

        IF v_secundario_id IS NOT NULL AND v_valor_secundario > 0 THEN
          INSERT INTO public.comissao_previsoes_participantes (
            empresa_id, venda_id, cota_definitiva_id, participante_comercial_id, papel_tipo,
            previsao_franquia_id, ordem_etapa, nome_etapa, competencia, base_calculo_valor,
            percentual_aplicado, valor_previsto, status, snapshot_regra
          ) VALUES (
            p_empresa_id, p_venda_id, v_cota.id, v_secundario_id, 'SDR',
            v_prev_id, 1, 'Comissão Única (SDR)', v_comp, v_valor_principal_bruto,
            v_fracao_secundario, v_valor_secundario, 'prevista',
            jsonb_build_object('perfil_secundario_id', v_perfil_secundario_id, 'reparticao_comercial', 'aplicada')
          );
        END IF;
      END IF;
    END IF;
  ELSE
    -- Sem regra cadastrada: fallback seguro
    v_comp := to_char(v_data_base_1, 'YYYY-MM');
    v_bruto := round(v_venda.valor_credito * (v_percentual / 100.0), 2);
    v_tax := round(v_bruto * (v_imposto / 100.0), 2);
    v_liquido := v_bruto - v_tax;

    INSERT INTO public.comissao_previsoes_franquia (
      empresa_id, venda_id, cota_definitiva_id, administradora_id, regra_franquia_id,
      ordem_etapa, nome_etapa, competencia, base_calculo_valor, percentual_aplicado,
      valor_previsto, status, snapshot_regra
    ) VALUES (
      p_empresa_id, p_venda_id, v_cota.id, v_venda.administradora_id, NULL,
      1, 'Comissão Única (Fallback)', v_comp, v_venda.valor_credito, v_percentual,
      v_bruto, 'prevista',
      jsonb_build_object('imposto_aliquota', v_imposto, 'imposto_valor', v_tax, 'valor_liquido', v_liquido, 'origem', 'fallback_4pct')
    ) RETURNING id INTO v_prev_id;

    IF v_principal_id IS NOT NULL THEN
      v_valor_principal_bruto := round(v_bruto * (v_percentual_principal / 100.0), 2);
      IF v_secundario_id IS NOT NULL AND v_fracao_secundario > 0 THEN
        v_valor_secundario := round(v_valor_principal_bruto * (v_fracao_secundario / 100.0), 2);
      ELSE
        v_valor_secundario := 0;
      END IF;
      v_valor_principal_liquido := v_valor_principal_bruto - v_valor_secundario;

      INSERT INTO public.comissao_previsoes_participantes (
        empresa_id, venda_id, cota_definitiva_id, participante_comercial_id, papel_tipo,
        previsao_franquia_id, ordem_etapa, nome_etapa, competencia, base_calculo_valor,
        percentual_aplicado, valor_previsto, status, snapshot_regra
      ) VALUES (
        p_empresa_id, p_venda_id, v_cota.id, v_principal_id, 'CONSULTOR',
        v_prev_id, 1, 'Comissão Única (Fallback)', v_comp, v_bruto,
        v_percentual_principal, v_valor_principal_liquido, 'prevista',
        jsonb_build_object('perfil_principal_id', v_perfil_principal_id, 'reparticao_comercial', 'aplicada')
      );

      IF v_secundario_id IS NOT NULL AND v_valor_secundario > 0 THEN
        INSERT INTO public.comissao_previsoes_participantes (
          empresa_id, venda_id, cota_definitiva_id, participante_comercial_id, papel_tipo,
          previsao_franquia_id, ordem_etapa, nome_etapa, competencia, base_calculo_valor,
          percentual_aplicado, valor_previsto, status, snapshot_regra
        ) VALUES (
          p_empresa_id, p_venda_id, v_cota.id, v_secundario_id, 'SDR',
          v_prev_id, 1, 'Comissão Única (SDR)', v_comp, v_valor_principal_bruto,
          v_fracao_secundario, v_valor_secundario, 'prevista',
          jsonb_build_object('perfil_secundario_id', v_perfil_secundario_id, 'reparticao_comercial', 'aplicada')
        );
      END IF;
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'franquia', COALESCE(jsonb_agg(to_jsonb(f) ORDER BY ordem_etapa), '[]'::jsonb),
    'participantes', (SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY competencia, ordem_etapa), '[]'::jsonb) FROM public.comissao_previsoes_participantes p WHERE p.venda_id = p_venda_id),
    'percentual_franqueadora', v_percentual,
    'percentual_principal', v_percentual_principal,
    'reused', false
  ) INTO v_result
  FROM public.comissao_previsoes_franquia f
  WHERE venda_id = p_venda_id;

  RETURN v_result;
END;
$$;

-- A conversão final só consome os UUIDs congelados pela RPC de preparação.
-- Não cria produtos, não escolhe primeiro grupo/modalidade e não usa valores estimados.
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
  v_regra public.comissao_regras_franquia%ROWTYPE;
  v_valor_modalidade record;
  v_modalidade record;
  v_dados jsonb;
  v_snapshot jsonb;
  v_response jsonb;
  v_previsoes jsonb;
  v_hash text;
  v_opcao_id uuid;
  v_modalidade_id uuid;
  v_perfil_principal_id uuid;
  v_perfil_secundario_id uuid;
  v_programa_id uuid;
  v_data_1 date;
  v_data_2 date;
  v_prazo_restante integer;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'Idempotency key obrigatória';
  END IF;
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id, 'formalizar_vendas') THEN
    RAISE EXCEPTION 'Sem permissão para formalizar vendas nesta empresa';
  END IF;

  v_hash := md5(p_contratacao_id::text);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text || ':CONVERSAO_VENDA:' || p_idempotency_key, 0));

  SELECT resposta INTO v_response
  FROM public.operacoes_idempotentes
  WHERE empresa_id = p_empresa_id
    AND operacao = 'CONVERSAO_VENDA'
    AND idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN v_response; END IF;

  SELECT * INTO v_contratacao
  FROM public.contratacoes_online
  WHERE id = p_contratacao_id AND empresa_id = p_empresa_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contratação não encontrada na empresa'; END IF;
  IF NOT COALESCE(v_contratacao.contrato_assinado, false) THEN
    RAISE EXCEPTION 'Contrato ainda não foi assinado';
  END IF;

  SELECT * INTO v_venda
  FROM public.vendas
  WHERE empresa_id = p_empresa_id AND contratacao_id = p_contratacao_id;
  IF FOUND THEN
    SELECT * INTO v_cota FROM public.cotas_definitivas
    WHERE empresa_id = p_empresa_id AND venda_id = v_venda.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Venda existente sem cota definitiva íntegra'; END IF;
    v_response := jsonb_build_object(
      'venda', to_jsonb(v_venda),
      'cotaDefinitiva', to_jsonb(v_cota),
      'previsoes', NULL,
      'reused', true
    );
    INSERT INTO public.operacoes_idempotentes(empresa_id, operacao, idempotency_key, payload_hash, recurso_id, resposta)
    VALUES (p_empresa_id, 'CONVERSAO_VENDA', p_idempotency_key, v_hash, v_venda.id, v_response)
    ON CONFLICT (empresa_id, operacao, idempotency_key) DO NOTHING;
    RETURN v_response;
  END IF;

  v_dados := COALESCE(v_contratacao.dados_simulacao, '{}'::jsonb);
  IF v_contratacao.grupo_id IS NULL THEN RAISE EXCEPTION 'Grupo canônico obrigatório'; END IF;
  SELECT * INTO v_grupo FROM public.grupos_consorcio
  WHERE id = v_contratacao.grupo_id AND ativo IS TRUE;
  IF NOT FOUND OR v_grupo.administradora_id IS NULL THEN
    RAISE EXCEPTION 'Grupo canônico ativo não encontrado';
  END IF;
  IF NOT public.grupo_concedido_para_empresa(p_empresa_id, v_grupo.id) THEN
    RAISE EXCEPTION 'Grupo não concedido para a empresa';
  END IF;

  IF v_contratacao.cota_id IS NULL
     OR v_contratacao.cota_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Produto/cota canônico obrigatório';
  END IF;
  v_opcao_id := v_contratacao.cota_id::uuid;
  SELECT * INTO v_opcao FROM public.grupos_cotas
  WHERE id = v_opcao_id AND grupo_id = v_grupo.id
    AND ativo IS TRUE
    AND COALESCE(lower(status), 'disponível') NOT IN ('inativo', 'esgotado');
  IF NOT FOUND OR v_opcao.valor_credito IS NULL OR v_opcao.valor_credito <= 0 THEN
    RAISE EXCEPTION 'Produto/cota não pertence ao grupo ou está indisponível';
  END IF;

  IF (v_dados->>'modalidade_comissao_id') IS NULL
     OR (v_dados->>'modalidade_comissao_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Modalidade canônica obrigatória';
  END IF;
  v_modalidade_id := (v_dados->>'modalidade_comissao_id')::uuid;
  SELECT mv.*, m.codigo, m.nome
    INTO v_valor_modalidade
  FROM public.grupo_cota_modalidade_valores mv
  JOIN public.grupos_modalidades_disponiveis gm
    ON gm.grupo_id = v_grupo.id
   AND gm.administradora_modalidade_id = mv.administradora_modalidade_id
   AND gm.ativo
  JOIN public.administradora_modalidades_comissao m
    ON m.id = mv.administradora_modalidade_id
   AND m.administradora_id = v_grupo.administradora_id
   AND m.ativo
  WHERE mv.grupo_cota_id = v_opcao.id
    AND mv.administradora_modalidade_id = v_modalidade_id
    AND mv.ativo
    AND mv.habilitado;
  IF v_valor_modalidade.id IS NULL OR v_valor_modalidade.valor_parcela <= 0 THEN
    RAISE EXCEPTION 'Modalidade sem valor homologado para o produto escolhido';
  END IF;

  v_prazo_restante := public.calcular_prazo_restante_grupo(v_grupo.id, CURRENT_DATE);
  IF v_prazo_restante IS NULL OR v_prazo_restante <= 0 THEN
    RAISE EXCEPTION 'Grupo sem parcelas restantes para nova venda';
  END IF;

  IF (v_dados->>'perfil_principal_id') IS NULL
     OR (v_dados->>'perfil_principal_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Perfil principal canônico obrigatório';
  END IF;
  v_perfil_principal_id := (v_dados->>'perfil_principal_id')::uuid;
  IF (v_dados->>'perfil_secundario_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_perfil_secundario_id := (v_dados->>'perfil_secundario_id')::uuid;
  END IF;
  IF (v_dados->>'data_primeira_parcela') ~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_data_1 := (v_dados->>'data_primeira_parcela')::date;
  END IF;
  IF (v_dados->>'data_segunda_parcela') ~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_data_2 := (v_dados->>'data_segunda_parcela')::date;
  END IF;

  SELECT rp.programa_id INTO v_programa_id
  FROM public.participante_comissao_perfis pc
  JOIN public.comissao_regras_participantes rp
    ON rp.empresa_id = pc.empresa_id AND rp.perfil_id = pc.perfil_id
  WHERE pc.empresa_id = p_empresa_id
    AND pc.participante_id = v_contratacao.participante_comercial_id
    AND pc.perfil_id = v_perfil_principal_id
    AND pc.ativo AND rp.ativa AND rp.configuracao_homologada AND rp.status = 'HOMOLOGADA'
    AND pc.vigencia_inicio <= CURRENT_DATE
    AND (pc.vigencia_fim IS NULL OR pc.vigencia_fim >= CURRENT_DATE)
    AND rp.vigencia_inicio <= CURRENT_DATE
    AND (rp.vigencia_fim IS NULL OR rp.vigencia_fim >= CURRENT_DATE);
  IF v_programa_id IS NULL THEN RAISE EXCEPTION 'Perfil principal sem regra homologada e vigente'; END IF;

  SELECT r.* INTO v_regra
  FROM public.comissao_regras_franquia r
  JOIN public.comissao_programas p ON p.id = r.programa_id
  WHERE r.empresa_id = p_empresa_id
    AND r.programa_id = v_programa_id
    AND p.administradora_id = v_grupo.administradora_id
    AND p.ativo AND p.status = 'ATIVO'
    AND r.ativa AND r.configuracao_homologada
    AND r.modalidade_comissao_id = v_modalidade_id
    AND (r.tipo_administradora_id IS NULL OR r.tipo_administradora_id = v_grupo.tipo_administradora_id)
    AND r.vigencia_inicio <= CURRENT_DATE
    AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= CURRENT_DATE);
  IF NOT FOUND OR v_regra.percentual_total_comissao IS NULL OR v_regra.percentual_total_comissao <= 0 THEN
    RAISE EXCEPTION 'Regra da franqueadora não homologada para o perfil, tipo e modalidade selecionados';
  END IF;

  IF v_contratacao.cliente_id IS NULL THEN
    SELECT id INTO v_contratacao.cliente_id
    FROM public.clientes
    WHERE empresa_id = p_empresa_id
      AND documento_normalizado = regexp_replace(COALESCE(v_contratacao.cpf, v_contratacao.cnpj, ''), '\D', '', 'g')
    LIMIT 1;
    IF v_contratacao.cliente_id IS NULL THEN
      INSERT INTO public.clientes(
        empresa_id, tipo_pessoa, nome, cpf_cnpj, documento_normalizado, email, telefone,
        cep, endereco, numero, complemento, bairro, cidade, uf,
        participante_comercial_id, origem, status, criado_por_contratacao_id
      ) VALUES (
        p_empresa_id, COALESCE(v_contratacao.tipo_pessoa, 'PF'),
        COALESCE(NULLIF(trim(v_contratacao.nome), ''), 'Cliente Consórcio'),
        COALESCE(v_contratacao.cpf, v_contratacao.cnpj),
        regexp_replace(COALESCE(v_contratacao.cpf, v_contratacao.cnpj, ''), '\D', '', 'g'),
        v_contratacao.email, v_contratacao.telefone, v_contratacao.cep,
        v_contratacao.endereco, v_contratacao.numero, v_contratacao.complemento,
        v_contratacao.bairro, v_contratacao.cidade, v_contratacao.uf,
        v_contratacao.participante_comercial_id, 'contratacao_assinada', 'ativo', p_contratacao_id
      ) RETURNING id INTO v_contratacao.cliente_id;
    END IF;
  END IF;

  v_snapshot := jsonb_build_object(
    'dados_simulacao', v_dados,
    'grupo_id', v_grupo.id,
    'grupo_codigo', v_grupo.codigo_grupo,
    'administradora_id', v_grupo.administradora_id,
    'tipo_administradora_id', v_grupo.tipo_administradora_id,
    'opcao_cota_id', v_opcao.id,
    'modalidade_comissao_id', v_modalidade_id,
    'modalidade_comissao_codigo', v_valor_modalidade.codigo,
    'programa_comissao_id', v_programa_id,
    'regra_franquia_id', v_regra.id,
    'percentual_franqueadora', v_regra.percentual_total_comissao,
    'perfil_principal_id', v_perfil_principal_id,
    'perfil_secundario_id', v_perfil_secundario_id,
    'participante_comercial_id', v_contratacao.participante_comercial_id,
    'participante_secundario_id', v_contratacao.participante_secundario_id,
    'fracao_secundario', v_contratacao.participante_secundario_fracao_percentual,
    'cronograma_secundario', v_dados->>'cronograma_secundario',
    'data_primeira_parcela', v_data_1,
    'data_segunda_parcela', v_data_2,
    'valor_credito', v_opcao.valor_credito,
    'valor_parcela', v_valor_modalidade.valor_parcela,
    'prazo_original_grupo', v_grupo.prazo_total,
    'parcelas_restantes_venda', v_prazo_restante,
    'prazo_referencia_em', CURRENT_DATE,
    'tipo_venda', v_valor_modalidade.codigo,
    'data_conversao', now()
  );

  INSERT INTO public.vendas(
    empresa_id, cliente_id, lead_id, contratacao_id, cliente_nome, cliente_cpf_cnpj,
    cliente_email, cliente_telefone, administradora_id, grupo_id, opcao_cota_id,
    modalidade_comissao_id, participante_comercial_id, organizacao_parceira_id,
    participante_secundario_id, participante_secundario_fracao_percentual,
    perfil_principal_id, perfil_secundario_id, data_primeira_parcela, data_segunda_parcela,
    valor_credito, prazo, parcela, status, snapshot_venda
  ) VALUES (
    p_empresa_id, v_contratacao.cliente_id, v_contratacao.lead_id, p_contratacao_id,
    COALESCE(NULLIF(trim(v_contratacao.nome), ''), 'Cliente Consórcio'),
    COALESCE(v_contratacao.cpf, v_contratacao.cnpj), v_contratacao.email, v_contratacao.telefone,
    v_grupo.administradora_id, v_grupo.id, v_opcao.id, v_modalidade_id,
    v_contratacao.participante_comercial_id, v_contratacao.organizacao_parceira_id,
    v_contratacao.participante_secundario_id, v_contratacao.participante_secundario_fracao_percentual,
    v_perfil_principal_id, v_perfil_secundario_id, v_data_1, v_data_2,
    v_opcao.valor_credito, v_prazo_restante, v_valor_modalidade.valor_parcela,
    'confirmada', v_snapshot
  ) RETURNING * INTO v_venda;

  INSERT INTO public.cotas_definitivas(
    empresa_id, venda_id, administradora_id, grupo_id, numero_grupo, numero_cota,
    valor_credito, prazo, parcela, status, participante_comercial_id,
    organizacao_parceira_id, snapshot_cota
  ) VALUES (
    p_empresa_id, v_venda.id, v_grupo.administradora_id, v_grupo.id, v_grupo.codigo_grupo,
    NULLIF(v_dados->>'numero_cota', ''), v_opcao.valor_credito, v_prazo_restante,
    v_valor_modalidade.valor_parcela, 'ativa', v_contratacao.participante_comercial_id,
    v_contratacao.organizacao_parceira_id, v_snapshot
  ) RETURNING * INTO v_cota;

  UPDATE public.contratacoes_online SET
    status = 'finalizada', cliente_id = v_contratacao.cliente_id,
    grupo_id = v_grupo.id, cota_id = v_opcao.id::text,
    credito_selecionado = v_opcao.valor_credito,
    parcela_estimada = v_valor_modalidade.valor_parcela,
    prazo = v_prazo_restante, status_operacional_erp = 'FORMALIZADA',
    pendencia_codigo = NULL, pendencia_descricao = NULL,
    formalizado_em = COALESCE(formalizado_em, now()),
    finalizado_em = COALESCE(finalizado_em, now()), updated_at = now()
  WHERE id = p_contratacao_id AND empresa_id = p_empresa_id;

  IF v_contratacao.lead_id IS NOT NULL THEN
    UPDATE public.leads SET status = 'ganho', updated_at = now()
    WHERE id = v_contratacao.lead_id AND empresa_id = p_empresa_id;
  END IF;

  SELECT public.rpc_gerar_previsoes_comissao_v2(
    p_empresa_id, v_venda.id, p_idempotency_key || ':comissao'
  ) INTO v_previsoes;
  v_response := jsonb_build_object(
    'venda', to_jsonb(v_venda), 'cotaDefinitiva', to_jsonb(v_cota),
    'previsoes', v_previsoes, 'reused', false
  );
  INSERT INTO public.operacoes_idempotentes(empresa_id, operacao, idempotency_key, payload_hash, recurso_id, resposta)
  VALUES (p_empresa_id, 'CONVERSAO_VENDA', p_idempotency_key, v_hash, v_venda.id, v_response);

  INSERT INTO public.contratacoes_formalizacao_historico(empresa_id, contratacao_id, evento, descricao, dados)
  VALUES (
    p_empresa_id, p_contratacao_id, 'VENDA_FORMALIZADA',
    'Venda, cota e previsões geradas a partir dos UUIDs canônicos homologados.',
    jsonb_build_object('venda_id', v_venda.id, 'cota_definitiva_id', v_cota.id, 'regra_franquia_id', v_regra.id)
  );
  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_converter_contratacao_venda(uuid,uuid,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_converter_contratacao_venda(uuid,uuid,text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
