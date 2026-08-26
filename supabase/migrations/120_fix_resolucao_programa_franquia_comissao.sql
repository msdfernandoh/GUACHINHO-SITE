-- 120: Resolução Precisa de Programa da Franqueadora e Comissão no Motor V2
BEGIN;

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
  v_percentual numeric := 4.0;
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
  v_percentual_principal numeric := 50.0;
  v_valor_principal_bruto numeric;
  v_valor_secundario numeric := 0;
  v_valor_principal_liquido numeric;
  v_modo_cronograma_sec text := 'SEGUIR_PRINCIPAL';
  v_total_secundario_acumulado numeric := 0;
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

  -- Se já existem previsões geradas, verifica se tem participantes
  IF EXISTS (SELECT 1 FROM public.comissao_previsoes_franquia WHERE venda_id = p_venda_id) THEN
    IF NOT EXISTS (SELECT 1 FROM public.comissao_previsoes_participantes WHERE venda_id = p_venda_id) THEN
      -- Se tinha franquia mas não tinha participantes, limpa para regerar completo
      DELETE FROM public.comissao_previsoes_franquia WHERE venda_id = p_venda_id;
    ELSE
      SELECT jsonb_build_object(
        'franquia', COALESCE(jsonb_agg(to_jsonb(f) ORDER BY ordem_etapa), '[]'::jsonb),
        'participantes', (SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY competencia, ordem_etapa), '[]'::jsonb) FROM public.comissao_previsoes_participantes p WHERE p.venda_id = p_venda_id),
        'reused', true
      ) INTO v_result
      FROM public.comissao_previsoes_franquia f
      WHERE venda_id = p_venda_id;
      RETURN v_result;
    END IF;
  END IF;

  -- Resolução de datas de comissão
  v_data_base_1 := COALESCE(v_venda.data_primeira_parcela, v_venda.data_venda::date, CURRENT_DATE);
  v_data_base_2 := COALESCE(v_venda.data_segunda_parcela, (v_data_base_1 + INTERVAL '1 month')::date);

  -- Identificação de participantes e perfis
  v_principal_id := COALESCE(v_venda.participante_comercial_id, (v_venda.snapshot_venda->>'participante_comercial_id')::uuid);
  v_secundario_id := COALESCE(v_venda.participante_secundario_id, (v_venda.snapshot_venda->>'participante_secundario_id')::uuid);
  v_fracao_secundario := COALESCE(v_venda.participante_secundario_fracao_percentual, (v_venda.snapshot_venda->>'fracao_secundario')::numeric, (v_venda.snapshot_venda->>'participante_secundario_fracao_percentual')::numeric, 0);
  v_perfil_principal_id := COALESCE(v_venda.perfil_principal_id, (v_venda.snapshot_venda->>'perfil_principal_id')::uuid);
  v_perfil_secundario_id := COALESCE(v_venda.perfil_secundario_id, (v_venda.snapshot_venda->>'perfil_secundario_id')::uuid);
  v_modo_cronograma_sec := COALESCE((v_venda.snapshot_venda->>'cronograma_secundario'), 'SEGUIR_PRINCIPAL');

  -- 0. Busca programa_id e percentual configurado na regra do perfil do consultor
  IF v_perfil_principal_id IS NOT NULL THEN
    SELECT r.programa_id, r.percentual_comissao
    INTO v_programa_principal_id, v_percentual_principal
    FROM public.comissao_regras_participantes r
    WHERE r.perfil_id = v_perfil_principal_id
      AND (r.empresa_id = p_empresa_id OR r.empresa_id IS NULL)
      AND r.ativa
    ORDER BY r.versao DESC LIMIT 1;
  END IF;

  -- Se principal tem override em participante_comissao_perfis
  IF v_principal_id IS NOT NULL THEN
    SELECT COALESCE(
      (SELECT override_percentual FROM public.participante_comissao_perfis WHERE empresa_id = p_empresa_id AND participante_id = v_principal_id AND (perfil_id = v_perfil_principal_id OR v_perfil_principal_id IS NULL) AND ativo AND override_percentual IS NOT NULL LIMIT 1),
      v_percentual_principal,
      (SELECT CASE WHEN papel_tipo = 'GESTOR' OR papel_tipo = 'SOCIO' THEN 100.0 ELSE 50.0 END FROM public.participante_comissao_perfis WHERE empresa_id = p_empresa_id AND participante_id = v_principal_id AND ativo LIMIT 1),
      50.0
    ) INTO v_percentual_principal;
  END IF;

  -- 1. Busca Regra da Franqueadora vinculada ao programa do perfil (ex: Franquia Antiga v1 -> 2%)
  SELECT r.*, p.nome as programa_nome INTO v_regra
  FROM public.comissao_regras_franquia r
  JOIN public.comissao_programas p ON p.id = r.programa_id
  WHERE (r.empresa_id = p_empresa_id OR r.empresa_id IS NULL)
    AND p.administradora_id = v_venda.administradora_id
    AND p.ativo
    AND r.ativa
    AND r.configuracao_homologada
    AND (v_programa_principal_id IS NULL OR r.programa_id = v_programa_principal_id)
    AND (r.tipo_administradora_id IS NULL OR r.tipo_administradora_id = v_grupo.tipo_administradora_id)
    AND (r.modalidade_comissao_id IS NULL OR r.modalidade_comissao_id = v_grupo.modalidade_comissao_id OR r.modalidade_comissao_id = v_venda.modalidade_comissao_id)
    AND r.vigencia_inicio <= v_venda.data_venda::date
    AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= v_venda.data_venda::date)
  ORDER BY
    (v_programa_principal_id IS NOT NULL AND r.programa_id = v_programa_principal_id) DESC,
    (r.tipo_administradora_id IS NOT NULL) DESC,
    (r.modalidade_comissao_id IS NOT NULL) DESC,
    r.versao DESC
  LIMIT 1;

  IF v_regra.id IS NULL AND v_programa_principal_id IS NOT NULL THEN
    SELECT r.*, p.nome as programa_nome INTO v_regra
    FROM public.comissao_regras_franquia r
    JOIN public.comissao_programas p ON p.id = r.programa_id
    WHERE r.programa_id = v_programa_principal_id AND r.ativa
    ORDER BY r.configuracao_homologada DESC, r.versao DESC LIMIT 1;
  END IF;

  IF v_regra.id IS NULL THEN
    SELECT r.*, p.nome as programa_nome INTO v_regra
    FROM public.comissao_regras_franquia r
    JOIN public.comissao_programas p ON p.id = r.programa_id
    WHERE (r.empresa_id = p_empresa_id OR r.empresa_id IS NULL) AND p.administradora_id = v_venda.administradora_id AND p.ativo AND r.ativa
    ORDER BY r.configuracao_homologada DESC, r.versao DESC LIMIT 1;
  END IF;

  -- Alíquota fiscal
  SELECT f.percentual_imposto INTO v_imposto
  FROM public.empresa_configuracoes_fiscais f
  WHERE f.empresa_id = p_empresa_id AND f.ativo AND f.vigencia_inicio <= v_venda.data_venda::date
    AND (f.vigencia_fim IS NULL OR f.vigencia_fim >= v_venda.data_venda::date)
  ORDER BY f.vigencia_inicio DESC LIMIT 1;
  v_imposto := COALESCE(v_imposto, 0);

  IF (v_venda.snapshot_venda->>'percentual_franqueadora') IS NOT NULL AND (v_venda.snapshot_venda->>'percentual_franqueadora') ~ '^[0-9]+(\.[0-9]+)?$' THEN
    v_percentual := (v_venda.snapshot_venda->>'percentual_franqueadora')::numeric;
  ELSIF v_regra.id IS NOT NULL THEN
    v_percentual := COALESCE(v_regra.percentual_total_comissao, 4.0);
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
          v_etapa.ordem, v_etapa.nome, v_comp, v_venda.valor_credito, v_etapa.percentual_venda,
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

          -- Insere previsão do Consultor Principal
          INSERT INTO public.comissao_previsoes_participantes (
            empresa_id, venda_id, cota_definitiva_id, participante_comercial_id, papel_tipo,
            previsao_franquia_id, ordem_etapa, competencia, percentual_aplicado, valor_previsto, status, snapshot_regra
          ) VALUES (
            p_empresa_id, p_venda_id, v_cota.id, v_principal_id, 'CONSULTOR',
            v_prev_id, v_etapa.ordem, v_comp, v_percentual_principal, v_valor_principal_liquido, 'prevista',
            jsonb_build_object(
              'fracao_secundario_deduzida', v_fracao_secundario,
              'valor_bruto_antes_split', v_valor_principal_bruto,
              'secundario_id', v_secundario_id,
              'perfil_principal_id', v_perfil_principal_id
            )
          );

          -- Insere previsão do Participante Secundário (SDR)
          IF v_secundario_id IS NOT NULL AND v_valor_secundario > 0 THEN
            INSERT INTO public.comissao_previsoes_participantes (
              empresa_id, venda_id, cota_definitiva_id, participante_comercial_id, papel_tipo,
              previsao_franquia_id, ordem_etapa, competencia, percentual_aplicado, valor_previsto, status, snapshot_regra
            ) VALUES (
              p_empresa_id, p_venda_id, v_cota.id, v_secundario_id, 'SDR',
              v_prev_id, v_etapa.ordem, v_comp, v_fracao_secundario, v_valor_secundario, 'prevista',
              jsonb_build_object(
                'fracao_sobre_principal', v_fracao_secundario,
                'principal_id', v_principal_id,
                'modo_cronograma', v_modo_cronograma_sec,
                'perfil_secundario_id', v_perfil_secundario_id
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
          previsao_franquia_id, ordem_etapa, competencia, percentual_aplicado, valor_previsto, status, snapshot_regra
        ) VALUES (
          p_empresa_id, p_venda_id, v_cota.id, v_principal_id, 'CONSULTOR',
          v_prev_id, 1, v_comp, v_percentual_principal, v_valor_principal_liquido, 'prevista',
          jsonb_build_object('fracao_secundario_deduzida', v_fracao_secundario, 'perfil_principal_id', v_perfil_principal_id)
        );

        IF v_secundario_id IS NOT NULL AND v_valor_secundario > 0 THEN
          INSERT INTO public.comissao_previsoes_participantes (
            empresa_id, venda_id, cota_definitiva_id, participante_comercial_id, papel_tipo,
            previsao_franquia_id, ordem_etapa, competencia, percentual_aplicado, valor_previsto, status, snapshot_regra
          ) VALUES (
            p_empresa_id, p_venda_id, v_cota.id, v_secundario_id, 'SDR',
            v_prev_id, 1, v_comp, v_fracao_secundario, v_valor_secundario, 'prevista',
            jsonb_build_object('perfil_secundario_id', v_perfil_secundario_id)
          );
        END IF;
      END IF;
    END IF;
  ELSE
    -- Sem regra cadastrada: fallback seguro 4%
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
        previsao_franquia_id, ordem_etapa, competencia, percentual_aplicado, valor_previsto, status, snapshot_regra
      ) VALUES (
        p_empresa_id, p_venda_id, v_cota.id, v_principal_id, 'CONSULTOR',
        v_prev_id, 1, v_comp, v_percentual_principal, v_valor_principal_liquido, 'prevista',
        jsonb_build_object('perfil_principal_id', v_perfil_principal_id)
      );

      IF v_secundario_id IS NOT NULL AND v_valor_secundario > 0 THEN
        INSERT INTO public.comissao_previsoes_participantes (
          empresa_id, venda_id, cota_definitiva_id, participante_comercial_id, papel_tipo,
          previsao_franquia_id, ordem_etapa, competencia, percentual_aplicado, valor_previsto, status, snapshot_regra
        ) VALUES (
          p_empresa_id, p_venda_id, v_cota.id, v_secundario_id, 'SDR',
          v_prev_id, 1, v_comp, v_fracao_secundario, v_valor_secundario, 'prevista',
          jsonb_build_object('perfil_secundario_id', v_perfil_secundario_id)
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

COMMIT;
