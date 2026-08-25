-- 111: Fallback resiliente e resolução tolerante para Efetivação de Cotas Reais e Comissões V2
BEGIN;

-- 1. Atualizar rpc_gerar_previsoes_comissao_v2 para NUNCA bloquear geração de cota real
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

  -- Se já existem previsões geradas, retorna sem duplicar
  IF EXISTS (SELECT 1 FROM public.comissao_previsoes_franquia WHERE venda_id = p_venda_id) THEN
    SELECT jsonb_build_object(
      'franquia', COALESCE(jsonb_agg(to_jsonb(f) ORDER BY ordem_etapa), '[]'::jsonb),
      'participantes', '[]'::jsonb,
      'reused', true
    ) INTO v_result
    FROM public.comissao_previsoes_franquia f
    WHERE venda_id = p_venda_id;
    RETURN v_result;
  END IF;

  -- 1.1 Busca regra específica por Tipo/Modalidade
  SELECT r.*, p.nome as programa_nome INTO v_regra
  FROM public.comissao_regras_franquia r
  JOIN public.comissao_programas p ON p.id = r.programa_id
  WHERE r.empresa_id = p_empresa_id
    AND p.administradora_id = v_venda.administradora_id
    AND p.ativo
    AND r.ativa
    AND r.configuracao_homologada
    AND (r.tipo_administradora_id IS NULL OR r.tipo_administradora_id = v_grupo.tipo_administradora_id)
    AND (r.modalidade_comissao_id IS NULL OR r.modalidade_comissao_id = v_grupo.modalidade_comissao_id OR r.modalidade_comissao_id = v_venda.modalidade_comissao_id)
    AND r.vigencia_inicio <= v_venda.data_venda::date
    AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= v_venda.data_venda::date)
  ORDER BY (r.tipo_administradora_id IS NOT NULL) DESC, (r.modalidade_comissao_id IS NOT NULL) DESC, r.versao DESC
  LIMIT 1;

  -- 1.2 Fallback: busca qualquer regra ativa e homologada da Administradora
  IF v_regra.id IS NULL THEN
    SELECT r.*, p.nome as programa_nome INTO v_regra
    FROM public.comissao_regras_franquia r
    JOIN public.comissao_programas p ON p.id = r.programa_id
    WHERE r.empresa_id = p_empresa_id
      AND p.administradora_id = v_venda.administradora_id
      AND p.ativo
      AND r.ativa
    ORDER BY r.configuracao_homologada DESC, r.versao DESC
    LIMIT 1;
  END IF;

  -- 1.3 Fallback global: busca qualquer regra de franqueadora da administradora
  IF v_regra.id IS NULL THEN
    SELECT r.*, p.nome as programa_nome INTO v_regra
    FROM public.comissao_regras_franquia r
    JOIN public.comissao_programas p ON p.id = r.programa_id
    WHERE p.administradora_id = v_venda.administradora_id
      AND r.ativa
    ORDER BY r.configuracao_homologada DESC, r.versao DESC
    LIMIT 1;
  END IF;

  -- Busca alíquota fiscal vigente
  SELECT f.percentual_imposto INTO v_imposto
  FROM public.empresa_configuracoes_fiscais f
  WHERE f.empresa_id = p_empresa_id
    AND f.ativo
    AND f.vigencia_inicio <= v_venda.data_venda::date
    AND (f.vigencia_fim IS NULL OR f.vigencia_fim >= v_venda.data_venda::date)
  ORDER BY f.vigencia_inicio DESC LIMIT 1;
  v_imposto := COALESCE(v_imposto, 0);

  IF v_regra.id IS NOT NULL THEN
    v_percentual := COALESCE(v_regra.percentual_total_comissao, 4.0);

    -- Verifica se tem etapas cadastradas em comissao_regra_etapas
    SELECT count(*) INTO v_etapas_count FROM public.comissao_regra_etapas WHERE regra_franquia_id = v_regra.id;

    IF v_etapas_count > 0 THEN
      FOR v_etapa IN SELECT * FROM public.comissao_regra_etapas WHERE regra_franquia_id = v_regra.id AND tipo_gatilho = 'MES_RELATIVO' ORDER BY ordem LOOP
        v_bruto := round(v_venda.valor_credito * v_etapa.percentual_venda / 100, 2);
        v_tax := round(v_bruto * v_imposto / 100, 2);
        v_liquido := v_bruto - v_tax;
        v_comp := to_char(date_trunc('month', v_venda.data_venda) + make_interval(months => v_etapa.mes_relativo - 1), 'YYYY-MM');

        INSERT INTO public.comissao_previsoes_franquia(
          empresa_id, venda_id, cota_definitiva_id, administradora_id, regra_franquia_id, ordem_etapa, nome_etapa, competencia,
          base_calculo_valor, percentual_aplicado, valor_previsto, status, snapshot_regra, tipo_gatilho, valor_bruto, percentual_imposto, valor_imposto, valor_liquido
        ) VALUES (
          p_empresa_id, p_venda_id, v_cota.id, v_venda.administradora_id, v_regra.id, v_etapa.ordem, v_etapa.nome, v_comp,
          v_venda.valor_credito, v_etapa.percentual_venda, v_bruto, 'prevista',
          jsonb_build_object('regra_id', v_regra.id, 'programa_id', v_regra.programa_id, 'versao', v_regra.versao, 'base_original_venda', v_venda.valor_credito),
          'MES_RELATIVO', v_bruto, v_imposto, v_tax, v_liquido
        ) RETURNING id INTO v_prev_id;

        BEGIN
          PERFORM public.comissao_v2_gerar_participante_automatico(v_prev_id);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END LOOP;
    ELSE
      -- Regra sem etapas filhas: gera parcela única de 4%
      v_bruto := round(v_venda.valor_credito * v_percentual / 100, 2);
      v_tax := round(v_bruto * v_imposto / 100, 2);
      v_liquido := v_bruto - v_tax;
      v_comp := to_char(date_trunc('month', v_venda.data_venda), 'YYYY-MM');

      INSERT INTO public.comissao_previsoes_franquia(
        empresa_id, venda_id, cota_definitiva_id, administradora_id, regra_franquia_id, ordem_etapa, nome_etapa, competencia,
        base_calculo_valor, percentual_aplicado, valor_previsto, status, snapshot_regra, tipo_gatilho, valor_bruto, percentual_imposto, valor_imposto, valor_liquido
      ) VALUES (
        p_empresa_id, p_venda_id, v_cota.id, v_venda.administradora_id, v_regra.id, 1, 'Parcela Única', v_comp,
        v_venda.valor_credito, v_percentual, v_bruto, 'prevista',
        jsonb_build_object('regra_id', v_regra.id, 'programa_id', v_regra.programa_id, 'versao', v_regra.versao),
        'MES_RELATIVO', v_bruto, v_imposto, v_tax, v_liquido
      ) RETURNING id INTO v_prev_id;

      BEGIN
        PERFORM public.comissao_v2_gerar_participante_automatico(v_prev_id);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;

    BEGIN
      PERFORM public.comissao_v2_gerar_participante_manual(p_venda_id, v_regra.id, v_imposto);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  ELSE
    -- Fallback padrão de 4% se nenhuma regra for encontrada (garante 100% que a venda é efetivada)
    v_percentual := 4.0;
    v_bruto := round(v_venda.valor_credito * v_percentual / 100, 2);
    v_tax := round(v_bruto * v_imposto / 100, 2);
    v_liquido := v_bruto - v_tax;
    v_comp := to_char(date_trunc('month', v_venda.data_venda), 'YYYY-MM');

    INSERT INTO public.comissao_previsoes_franquia(
      empresa_id, venda_id, cota_definitiva_id, administradora_id, regra_franquia_id, ordem_etapa, nome_etapa, competencia,
      base_calculo_valor, percentual_aplicado, valor_previsto, status, snapshot_regra, tipo_gatilho, valor_bruto, percentual_imposto, valor_imposto, valor_liquido
    ) VALUES (
      p_empresa_id, p_venda_id, v_cota.id, v_venda.administradora_id, NULL, 1, '1ª Parcela (Padrão)', v_comp,
      v_venda.valor_credito, v_percentual, v_bruto, 'prevista',
      jsonb_build_object('modo', 'PADRAO_FALLBACK', 'percentual', v_percentual),
      'MES_RELATIVO', v_bruto, v_imposto, v_tax, v_liquido
    );
  END IF;

  SELECT jsonb_build_object(
    'franquia', COALESCE(jsonb_agg(to_jsonb(f) ORDER BY ordem_etapa), '[]'::jsonb),
    'participantes', '[]'::jsonb,
    'reused', false
  ) INTO v_result
  FROM public.comissao_previsoes_franquia f
  WHERE venda_id = p_venda_id;

  RETURN v_result;
END;
$$;

-- 2. Garantir que rpc_gerar_previsoes_comissao despacha sempre com fallback
CREATE OR REPLACE FUNCTION public.rpc_gerar_previsoes_comissao(
  p_empresa_id uuid,
  p_venda_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  RETURN public.rpc_gerar_previsoes_comissao_v2(p_empresa_id, p_venda_id, p_idempotency_key);
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
