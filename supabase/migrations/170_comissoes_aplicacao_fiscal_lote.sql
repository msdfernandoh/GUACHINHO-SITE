-- Aplicação explícita de uma alíquota cadastrada às previsões ainda sem movimento.
-- A instalação não recalcula registros. Prévia e confirmação utilizam a mesma RPC.
BEGIN;

CREATE OR REPLACE FUNCTION public.comissao_bruto_para_aplicacao_fiscal(
  p_snapshot jsonb, p_valor numeric, p_franquia_snapshot jsonb,
  p_franquia_aliquota numeric
) RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE v_bruto numeric; v_aliquota numeric;
BEGIN
  -- Sempre reaproveitar o bruto original; repetir a operação não acumula desconto.
  IF p_snapshot->'fiscal_lote'->>'valor_bruto' IS NOT NULL THEN
    v_bruto := (p_snapshot->'fiscal_lote'->>'valor_bruto')::numeric;
  ELSIF p_snapshot->>'origem' = 'IMPORTACAO_LEGADO'
      AND p_snapshot->>'valor_bruto' IS NOT NULL THEN
    v_bruto := (p_snapshot->>'valor_bruto')::numeric;
  ELSIF p_snapshot->>'reparticao_comercial' = 'aplicada' THEN
    -- Motor canônico 127: a repartição foi persistida sobre o bruto, não o líquido.
    v_bruto := p_valor;
  ELSIF p_snapshot->>'fonte_liquida' = 'true'
      OR p_snapshot->>'papel' IN ('PRINCIPAL', 'SECUNDARIO') THEN
    v_aliquota := coalesce(p_franquia_aliquota,
      (p_franquia_snapshot->>'imposto_aliquota')::numeric);
    IF v_aliquota IS NULL OR v_aliquota < 0 OR v_aliquota >= 100 THEN RETURN NULL; END IF;
    v_bruto := round(p_valor / (1 - v_aliquota / 100), 2);
  ELSE
    -- Não adivinhar se um registro de origem desconhecida já está líquido.
    RETURN NULL;
  END IF;
  IF v_bruto < 0 OR v_bruto::text IN ('NaN', 'Infinity', '-Infinity') THEN RETURN NULL; END IF;
  RETURN round(v_bruto, 2);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.comissao_bruto_para_aplicacao_fiscal(jsonb,numeric,jsonb,numeric)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_aplicar_imposto_comissoes_lote(
  p_empresa_id uuid, p_configuracao_fiscal_id uuid, p_confirmar boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_config record; v_venda record; v_p record; v_f record;
  v_bruto numeric; v_imposto numeric; v_liquido numeric;
  v_itens jsonb := '[]'::jsonb; v_item jsonb; v_detalhes jsonb := '[]'::jsonb;
  v_ambiguo boolean; v_participantes integer := 0; v_franquia integer := 0;
  v_protegidas integer := 0; v_sem_base integer := 0;
  v_antes numeric := 0; v_depois numeric := 0; v_total_imposto numeric := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.can_write_tenant_internal(p_empresa_id), false) THEN
    RAISE EXCEPTION 'Somente o administrador da empresa pode aplicar imposto em lote';
  END IF;
  SELECT * INTO v_config FROM public.empresa_configuracoes_fiscais
    WHERE id = p_configuracao_fiscal_id AND empresa_id = p_empresa_id AND ativo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Configuração fiscal ativa não encontrada nesta empresa'; END IF;
  IF v_config.percentual_imposto IS NULL OR v_config.percentual_imposto < 0 OR v_config.percentual_imposto >= 100 THEN
    RAISE EXCEPTION 'Alíquota fiscal inválida';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text || ':FISCAL_LOTE', 0));
  -- Mesma ordem dos fluxos financeiros: venda, franquia, participante.
  FOR v_venda IN SELECT v.* FROM public.vendas v WHERE v.empresa_id = p_empresa_id
    AND (EXISTS (SELECT 1 FROM public.comissao_previsoes_franquia f WHERE f.empresa_id = p_empresa_id AND f.venda_id = v.id)
      OR EXISTS (SELECT 1 FROM public.comissao_previsoes_participantes p WHERE p.empresa_id = p_empresa_id AND p.venda_id = v.id))
    ORDER BY v.id FOR UPDATE
  LOOP
    PERFORM id FROM public.comissao_previsoes_franquia
      WHERE empresa_id = p_empresa_id AND venda_id = v_venda.id ORDER BY id FOR UPDATE;
    PERFORM id FROM public.comissao_previsoes_participantes
      WHERE empresa_id = p_empresa_id AND venda_id = v_venda.id ORDER BY id FOR UPDATE;
    -- Conservador: qualquer movimento preserva a venda inteira e seus rateios.
    IF v_venda.status <> 'confirmada' OR EXISTS (
      SELECT 1 FROM public.comissao_previsoes_franquia f
      WHERE f.empresa_id = p_empresa_id AND f.venda_id = v_venda.id
        AND (f.status <> 'prevista' OR f.valor_liquidado <> 0 OR EXISTS (
          SELECT 1 FROM public.financeiro_recebimento_itens i WHERE i.previsao_franquia_id = f.id))
    ) OR EXISTS (
      SELECT 1 FROM public.comissao_previsoes_participantes p
      WHERE p.empresa_id = p_empresa_id AND p.venda_id = v_venda.id
        AND (p.status <> 'prevista' OR p.valor_pago <> 0 OR p.valor_elegivel <> 0
          OR p.conferido_por_participante OR EXISTS (
            SELECT 1 FROM public.financeiro_pagamento_itens i WHERE i.previsao_participante_id = p.id))
    ) THEN
      v_protegidas := v_protegidas + 1; CONTINUE;
    END IF;

    v_itens := '[]'::jsonb; v_ambiguo := false;
    FOR v_p IN SELECT p.*, f.snapshot_regra AS fiscal_franquia_snapshot,
      f.percentual_imposto AS fiscal_franquia_aliquota
      FROM public.comissao_previsoes_participantes p
      LEFT JOIN public.comissao_previsoes_franquia f ON f.empresa_id = p.empresa_id AND f.venda_id = p.venda_id
        AND (f.id = p.previsao_franquia_id OR (p.previsao_franquia_id IS NULL
          AND f.id::text = coalesce(p.snapshot_regra->>'fonte_previsao_franquia_id', p.snapshot_regra->>'previsao_franquia_id')))
      WHERE p.empresa_id = p_empresa_id AND p.venda_id = v_venda.id ORDER BY p.id
    LOOP
      v_bruto := public.comissao_bruto_para_aplicacao_fiscal(v_p.snapshot_regra,
        v_p.valor_previsto, v_p.fiscal_franquia_snapshot, v_p.fiscal_franquia_aliquota);
      IF v_bruto IS NULL THEN v_ambiguo := true; EXIT; END IF;
      v_imposto := round(v_bruto * v_config.percentual_imposto / 100, 2);
      v_liquido := v_bruto - v_imposto;
      v_itens := v_itens || jsonb_build_array(jsonb_build_object('id', v_p.id,
        'antes', v_p.valor_previsto, 'bruto', v_bruto, 'imposto', v_imposto, 'liquido', v_liquido));
    END LOOP;
    IF v_ambiguo THEN v_sem_base := v_sem_base + 1; CONTINUE; END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(v_itens) LOOP
      v_participantes := v_participantes + 1;
      v_antes := v_antes + (v_item->>'antes')::numeric;
      v_depois := v_depois + (v_item->>'liquido')::numeric;
      v_total_imposto := v_total_imposto + (v_item->>'imposto')::numeric;
      IF coalesce(p_confirmar, false) THEN
        UPDATE public.comissao_previsoes_participantes SET
          valor_previsto = (v_item->>'liquido')::numeric,
          snapshot_regra = coalesce(snapshot_regra, '{}'::jsonb) || jsonb_build_object('fiscal_lote', jsonb_build_object(
            'valor_bruto', (v_item->>'bruto')::numeric, 'imposto_aliquota', v_config.percentual_imposto,
            'imposto_valor', (v_item->>'imposto')::numeric, 'valor_liquido', (v_item->>'liquido')::numeric,
            'configuracao_id', v_config.id, 'usuario_id', public.current_usuario_id(), 'aplicado_em', now())),
          updated_at = now()
        WHERE id = (v_item->>'id')::uuid AND empresa_id = p_empresa_id;
      END IF;
    END LOOP;
    FOR v_f IN SELECT * FROM public.comissao_previsoes_franquia
      WHERE empresa_id = p_empresa_id AND venda_id = v_venda.id ORDER BY id LOOP
      v_bruto := coalesce(v_f.valor_bruto, v_f.valor_previsto);
      v_imposto := round(v_bruto * v_config.percentual_imposto / 100, 2);
      v_liquido := v_bruto - v_imposto;
      v_franquia := v_franquia + 1;
      IF coalesce(p_confirmar, false) THEN
        UPDATE public.comissao_previsoes_franquia SET valor_bruto = v_bruto,
          percentual_imposto = v_config.percentual_imposto, valor_imposto = v_imposto, valor_liquido = v_liquido,
          snapshot_regra = coalesce(snapshot_regra, '{}'::jsonb) || jsonb_build_object(
            'imposto_aliquota', v_config.percentual_imposto, 'imposto_valor', v_imposto, 'valor_liquido', v_liquido,
            'fiscal_lote_configuracao_id', v_config.id), updated_at = now()
        WHERE id = v_f.id AND empresa_id = p_empresa_id;
        v_detalhes := v_detalhes || jsonb_build_array(jsonb_build_object('franquia_id', v_f.id,
          'antes', jsonb_build_object('aliquota', v_f.percentual_imposto, 'liquido', v_f.valor_liquido),
          'aliquota', v_config.percentual_imposto, 'liquido', v_liquido));
      END IF;
    END LOOP;
    IF coalesce(p_confirmar, false) THEN v_detalhes := v_detalhes || v_itens; END IF;
  END LOOP;
  IF coalesce(p_confirmar, false) AND (v_participantes > 0 OR v_franquia > 0) THEN
    INSERT INTO public.audit_logs_central (empresa_id, usuario_id, modulo, acao, entidade_tipo, entidade_id, detalhes)
    VALUES (p_empresa_id, public.current_usuario_id(), 'comissoes', 'APLICAR_IMPOSTO_LOTE',
      'empresa_configuracoes_fiscais', v_config.id, jsonb_build_object('aliquota', v_config.percentual_imposto,
        'escopo', 'TODAS_PREVISOES_SEM_MOVIMENTO', 'alteracoes', v_detalhes));
  END IF;
  RETURN jsonb_build_object('confirmado', coalesce(p_confirmar, false), 'aliquota', v_config.percentual_imposto,
    'participantes', v_participantes, 'franquia', v_franquia, 'vendas_protegidas', v_protegidas,
    'vendas_sem_base_segura', v_sem_base, 'liquido_anterior', v_antes, 'liquido_novo', v_depois,
    'imposto_participantes', v_total_imposto);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_aplicar_imposto_comissoes_lote(uuid,uuid,boolean)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_aplicar_imposto_comissoes_lote(uuid,uuid,boolean) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
