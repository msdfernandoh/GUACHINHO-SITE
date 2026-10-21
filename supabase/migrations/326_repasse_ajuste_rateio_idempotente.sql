-- Preserva o rateio original entre sincronizações e atualiza elegibilidade
-- junto da previsão, sem violar saldo quando o relatório reduz a parcela.
-- Nenhum backfill ou alteração automática de dados existentes.
BEGIN;
CREATE OR REPLACE FUNCTION public.sincronizar_item_repasse_canonico_203(p_empresa_id uuid, p_item_id uuid, p_usuario_id uuid DEFAULT NULL::uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item public.erp_repasse_importacao_itens%ROWTYPE;
  v_importacao public.erp_repasse_importacoes%ROWTYPE;
  v_previsao public.comissao_previsoes_franquia%ROWTYPE;
  v_atual numeric(14,2);
  v_fri_atual numeric(14,2);
  v_desejado numeric(14,2);
  v_delta numeric(14,2);
  v_recebido numeric(14,2);
  v_classificado numeric(14,2);
  v_rateio_total numeric(14,2);
  v_percentual numeric(8,4);
  v_imposto numeric(14,2);
  v_liquido numeric(14,2);
  v_antigo_liquido numeric(14,2);
  v_key text;
  v_p record;
  v_razao numeric;
  v_novo_p numeric(14,2);
  v_bruto_p numeric(14,2);
BEGIN
  SELECT * INTO v_item
  FROM public.erp_repasse_importacao_itens
  WHERE id = p_item_id AND empresa_id = p_empresa_id
  FOR UPDATE;
  IF NOT FOUND OR v_item.previsao_franquia_id IS NULL THEN
    RAISE EXCEPTION 'Item de repasse sem previsao vinculada';
  END IF;

  SELECT * INTO v_importacao
  FROM public.erp_repasse_importacoes
  WHERE id = v_item.importacao_id AND empresa_id = p_empresa_id
  FOR UPDATE;
  IF NOT FOUND OR v_importacao.recebimento_id IS NULL THEN
    RAISE EXCEPTION 'Importacao sem recebimento financeiro';
  END IF;

  SELECT * INTO v_previsao
  FROM public.comissao_previsoes_franquia
  WHERE id = v_item.previsao_franquia_id AND empresa_id = p_empresa_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Previsao vinculada nao encontrada'; END IF;

  SELECT round(COALESCE(sum(valor_liquidado), 0), 2) INTO v_atual
  FROM public.erp_repasse_item_baixas
  WHERE empresa_id = p_empresa_id AND item_importacao_id = p_item_id;

  SELECT round(COALESCE(sum(valor_liquidado), 0), 2) INTO v_fri_atual
  FROM public.financeiro_recebimento_itens
  WHERE recebimento_id = v_importacao.recebimento_id
    AND previsao_franquia_id = v_item.previsao_franquia_id;

  -- Se ja houver lancamento para este recebimento e previsao, considera o maior valor para evitar duplicar
  v_atual := greatest(v_atual, v_fri_atual);

  v_desejado := round(v_item.valor_comissao, 2);
  v_delta := round(v_desejado - v_atual, 2);

  IF v_delta > 0 THEN
    SELECT valor_total INTO v_recebido
    FROM public.financeiro_recebimentos
    WHERE id = v_importacao.recebimento_id AND empresa_id = p_empresa_id
    FOR UPDATE;

    SELECT round(COALESCE(sum(valor), 0), 2) INTO v_classificado
    FROM public.financeiro_recebimento_classificacoes
    WHERE recebimento_id = v_importacao.recebimento_id AND empresa_id = p_empresa_id;

    SELECT round(COALESCE(sum(valor_liquidado), 0), 2) INTO v_rateio_total
    FROM public.financeiro_recebimento_itens
    WHERE recebimento_id = v_importacao.recebimento_id;

    IF v_delta > round(COALESCE(v_recebido, 0) - v_classificado - v_rateio_total, 2) + 0.009 THEN
      RAISE EXCEPTION 'Saldo do recebimento insuficiente para completar a linha do relatorio';
    END IF;
  END IF;

  IF abs(v_delta) >= 0.01 THEN
    v_key := 'sync-203:' || p_item_id::text || ':' || v_item.previsao_franquia_id::text || ':' || md5(v_atual::text || ':' || v_desejado::text);

    INSERT INTO public.financeiro_recebimento_itens (
      recebimento_id, previsao_franquia_id, valor_liquidado
    ) VALUES (
      v_importacao.recebimento_id, v_item.previsao_franquia_id, v_delta
    );

    INSERT INTO public.erp_repasse_item_baixas (
      empresa_id, item_importacao_id, recebimento_id, previsao_franquia_id,
      valor_liquidado, evento, idempotency_key, criado_por
    ) VALUES (
      p_empresa_id, p_item_id, v_importacao.recebimento_id, v_item.previsao_franquia_id,
      v_delta, 'SINCRONIZACAO', v_key, p_usuario_id
    ) ON CONFLICT (empresa_id, idempotency_key) DO NOTHING;
  END IF;

  v_percentual := COALESCE(v_previsao.percentual_imposto, 0);
  v_imposto := round(v_desejado * v_percentual / 100, 2);
  v_liquido := round(v_desejado - v_imposto, 2);
  v_antigo_liquido := greatest(COALESCE(v_previsao.valor_liquido, v_previsao.valor_previsto, 0), 0.01);

  UPDATE public.comissao_previsoes_franquia
  SET valor_bruto = v_desejado,
      valor_previsto = v_desejado,
      base_calculo_valor = v_desejado,
      valor_imposto = v_imposto,
      valor_liquido = v_liquido,
      snapshot_regra = COALESCE(snapshot_regra, '{}'::jsonb) || jsonb_build_object(
        'repasse_canonico_203', jsonb_build_object(
          'valor_bruto', v_desejado, 'valor_imposto', v_imposto,
          'valor_liquido', v_liquido, 'origem_valor', 'ITEM_RELATORIO_REPASSE',
          'item_importacao_id', p_item_id, 'sincronizado_em', now()
        )
      ),
      updated_at = now()
  WHERE id = v_item.previsao_franquia_id;

  FOR v_p IN
    SELECT * FROM public.comissao_previsoes_participantes
    WHERE empresa_id = p_empresa_id AND previsao_franquia_id = v_item.previsao_franquia_id
    ORDER BY id FOR UPDATE
  LOOP
    v_razao := CASE
      WHEN COALESCE(v_p.snapshot_regra->'repasse_canonico_203'->>'razao_participante', '') ~ '^[0-9]+([.][0-9]+)?$'
        THEN (v_p.snapshot_regra->'repasse_canonico_203'->>'razao_participante')::numeric
      WHEN COALESCE(v_p.snapshot_regra->'fiscal_lote'->>'valor_bruto', '') ~ '^[0-9]+([.][0-9]+)?$'
        AND COALESCE(v_previsao.valor_bruto, 0) > 0
        THEN (v_p.snapshot_regra->'fiscal_lote'->>'valor_bruto')::numeric / v_previsao.valor_bruto
      ELSE COALESCE(v_p.valor_previsto, 0) / v_antigo_liquido
    END;
    v_bruto_p := round(v_desejado * v_razao, 2);
    v_novo_p := round(v_liquido * v_razao, 2);
    IF COALESCE(v_p.valor_pago, 0) > v_novo_p + 0.009 THEN
      RAISE EXCEPTION 'Ajuste reduziria uma comissao ja paga';
    END IF;
    UPDATE public.comissao_previsoes_participantes
    SET valor_previsto = v_novo_p,
        valor_elegivel = greatest(COALESCE(valor_pago, 0), least(COALESCE(valor_elegivel, 0), v_novo_p)),
        base_calculo_valor = v_desejado,
        snapshot_regra = COALESCE(snapshot_regra, '{}'::jsonb) || jsonb_build_object(
          'repasse_canonico_203', jsonb_build_object(
            'origem_valor', 'PREVISAO_FRANQUIA_CANONICA',
            'razao_participante', v_razao,
            'previsao_franquia_id', v_item.previsao_franquia_id,
            'item_importacao_id', p_item_id,
            'sincronizado_em', now()
          ),
          'fiscal_lote', COALESCE(snapshot_regra->'fiscal_lote', '{}'::jsonb) || jsonb_build_object(
            'valor_bruto', v_bruto_p,
            'imposto_valor', round(v_bruto_p - v_novo_p, 2),
            'valor_liquido', v_novo_p,
            'imposto_aliquota', v_percentual
          )
        ),
        updated_at = now()
    WHERE id = v_p.id;
  END LOOP;

  PERFORM public.recalcular_liquidacao_previsao_repasse_203(p_empresa_id, v_item.previsao_franquia_id);

  SELECT round(COALESCE(sum(valor_liquidado), 0), 2) INTO v_atual
  FROM public.erp_repasse_item_baixas
  WHERE empresa_id = p_empresa_id AND item_importacao_id = p_item_id;
  RETURN v_atual;
END;
$function$;

COMMIT;
