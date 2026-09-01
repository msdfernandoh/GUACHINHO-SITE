-- Fase 208: a exclusao master de uma venda criada pelo PDF deve reverter a baixa
-- de forma append-only e reabrir a linha para um novo vinculo.

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_master_excluir_ou_estornar_venda(
  p_empresa_id uuid,
  p_venda_id uuid,
  p_acao text,
  p_cancelar_comissoes_pagas boolean DEFAULT false,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venda public.vendas%ROWTYPE;
  v_contratacao_id uuid;
  v_item record;
  v_previsao record;
  v_alocacao numeric(14,2);
  v_tem_historico boolean := false;
  v_itens_reabertos integer := 0;
  v_motivo text := COALESCE(NULLIF(trim(p_motivo), ''), 'Exclusao administrativa de cadastro incorreto');
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado: operacao restrita ao tenant master';
  END IF;

  SELECT * INTO v_venda
  FROM public.vendas
  WHERE id = p_venda_id AND empresa_id = p_empresa_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda nao encontrada'; END IF;
  v_contratacao_id := v_venda.contratacao_id;

  IF p_acao = 'ESTORNAR' THEN
    UPDATE public.vendas SET status = 'cancelada', updated_at = now() WHERE id = p_venda_id;
    UPDATE public.cotas_definitivas
    SET status = 'cancelada', motivo_cancelamento = v_motivo, updated_at = now()
    WHERE venda_id = p_venda_id;

    IF p_cancelar_comissoes_pagas THEN
      UPDATE public.comissao_previsoes_franquia SET status = 'cancelada', updated_at = now() WHERE venda_id = p_venda_id;
      UPDATE public.comissao_previsoes_participantes SET status = 'cancelada', updated_at = now() WHERE venda_id = p_venda_id;
    ELSE
      UPDATE public.comissao_previsoes_franquia SET status = 'cancelada', updated_at = now()
      WHERE venda_id = p_venda_id AND status <> 'liquidada';
      UPDATE public.comissao_previsoes_participantes SET status = 'cancelada', updated_at = now()
      WHERE venda_id = p_venda_id AND status <> 'paga';
    END IF;

    RETURN jsonb_build_object('ok', true, 'acao', 'ESTORNAR', 'venda_id', p_venda_id);
  ELSIF p_acao <> 'EXCLUIR' THEN
    RAISE EXCEPTION 'Acao invalida. Escolha EXCLUIR ou ESTORNAR';
  END IF;

  -- Uma comissao paga nao pode desaparecer. O estorno do pagamento deve ocorrer
  -- antes da exclusao do cadastro que originou a previsao.
  IF EXISTS (
    SELECT 1 FROM public.comissao_previsoes_participantes
    WHERE empresa_id = p_empresa_id AND venda_id = p_venda_id
      AND COALESCE(valor_pago, 0) > 0
  ) THEN
    RAISE EXCEPTION 'Existem comissoes de participantes ja pagas. Estorne o pagamento antes de excluir o cadastro.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.comissao_previsoes_franquia pf
    WHERE pf.empresa_id = p_empresa_id AND pf.venda_id = p_venda_id
      AND (
        EXISTS (SELECT 1 FROM public.financeiro_recebimento_itens ri WHERE ri.previsao_franquia_id = pf.id)
        OR EXISTS (SELECT 1 FROM public.erp_repasse_item_baixas b WHERE b.empresa_id = p_empresa_id AND b.previsao_franquia_id = pf.id)
        OR EXISTS (SELECT 1 FROM public.erp_repasse_atencao_resolucoes r WHERE r.empresa_id = p_empresa_id AND r.previsao_franquia_id = pf.id)
      )
  ) INTO v_tem_historico;

  -- Primeiro desfaz cada baixa vinculada e reabre a linha do PDF. Os livros
  -- financeiro e de repasse sao append-only: a correcao e um valor negativo.
  FOR v_item IN
    SELECT i.*, imp.recebimento_id
    FROM public.erp_repasse_importacao_itens i
    JOIN public.erp_repasse_importacoes imp
      ON imp.id = i.importacao_id AND imp.empresa_id = i.empresa_id
    JOIN public.comissao_previsoes_franquia pf
      ON pf.id = i.previsao_franquia_id AND pf.empresa_id = i.empresa_id
    WHERE i.empresa_id = p_empresa_id AND pf.venda_id = p_venda_id
    ORDER BY i.id
    FOR UPDATE OF i, imp
  LOOP
    SELECT round(COALESCE(sum(valor_liquidado), 0), 2)
    INTO v_alocacao
    FROM public.erp_repasse_item_baixas
    WHERE empresa_id = p_empresa_id AND item_importacao_id = v_item.id;

    IF abs(v_alocacao) >= 0.01 THEN
      INSERT INTO public.financeiro_recebimento_itens (
        recebimento_id, previsao_franquia_id, valor_liquidado
      ) VALUES (
        v_item.recebimento_id, v_item.previsao_franquia_id, -v_alocacao
      );

      INSERT INTO public.erp_repasse_item_baixas (
        empresa_id, item_importacao_id, recebimento_id, previsao_franquia_id,
        valor_liquidado, evento, idempotency_key, criado_por
      ) VALUES (
        p_empresa_id, v_item.id, v_item.recebimento_id, v_item.previsao_franquia_id,
        -v_alocacao, 'REVERSAO',
        'exclusao-venda-208:' || p_venda_id::text || ':' || v_item.id::text,
        auth.uid()
      ) ON CONFLICT (empresa_id, idempotency_key) DO NOTHING;
    END IF;

    UPDATE public.erp_repasse_importacao_itens
    SET status_conciliacao = 'NAO_ENCONTRADO',
        previsao_franquia_id = NULL,
        previsao_sugerida_id = NULL,
        venda_id = NULL,
        participante_comercial_id = NULL,
        vinculado_por_usuario_id = NULL,
        vinculado_em = NULL,
        alertas = COALESCE(alertas, '[]'::jsonb) || jsonb_build_array(
          'Vinculo anterior removido por exclusao administrativa: ' || v_motivo
        ),
        updated_at = now()
    WHERE id = v_item.id;

    UPDATE public.erp_repasse_importacoes
    SET status = 'PENDENTE', updated_at = now()
    WHERE id = v_item.importacao_id;
    v_itens_reabertos := v_itens_reabertos + 1;
    v_tem_historico := true;
  END LOOP;

  FOR v_previsao IN
    SELECT id FROM public.comissao_previsoes_franquia
    WHERE empresa_id = p_empresa_id AND venda_id = p_venda_id
  LOOP
    PERFORM public.recalcular_liquidacao_previsao_repasse_203(p_empresa_id, v_previsao.id);
  END LOOP;

  IF v_tem_historico THEN
    -- O cadastro sai da operacao, mas permanece como tombstone auditavel porque
    -- lancamentos financeiros historicos nao podem ser apagados.
    UPDATE public.comissao_previsoes_participantes
    SET status = 'cancelada',
        snapshot_regra = COALESCE(snapshot_regra, '{}'::jsonb) || jsonb_build_object(
          'exclusao_administrativa_208', jsonb_build_object('motivo', v_motivo, 'em', now(), 'usuario_id', auth.uid())
        ),
        updated_at = now()
    WHERE empresa_id = p_empresa_id AND venda_id = p_venda_id;

    UPDATE public.comissao_previsoes_franquia
    SET status = 'cancelada',
        snapshot_regra = COALESCE(snapshot_regra, '{}'::jsonb) || jsonb_build_object(
          'exclusao_administrativa_208', jsonb_build_object('motivo', v_motivo, 'em', now(), 'usuario_id', auth.uid())
        ),
        updated_at = now()
    WHERE empresa_id = p_empresa_id AND venda_id = p_venda_id;

    UPDATE public.cotas_definitivas
    SET status = 'cancelada', motivo_cancelamento = v_motivo, updated_at = now()
    WHERE empresa_id = p_empresa_id AND venda_id = p_venda_id;

    UPDATE public.vendas
    SET status = 'cancelada',
        snapshot_venda = COALESCE(snapshot_venda, '{}'::jsonb) || jsonb_build_object(
          'exclusao_administrativa_208', jsonb_build_object('motivo', v_motivo, 'em', now(), 'usuario_id', auth.uid())
        ),
        updated_at = now()
    WHERE empresa_id = p_empresa_id AND id = p_venda_id;
  ELSE
    DELETE FROM public.comissao_previsoes_participantes WHERE empresa_id = p_empresa_id AND venda_id = p_venda_id;
    DELETE FROM public.comissao_previsoes_franquia WHERE empresa_id = p_empresa_id AND venda_id = p_venda_id;
    DELETE FROM public.venda_participantes WHERE empresa_id = p_empresa_id AND venda_id = p_venda_id;
    DELETE FROM public.cota_contemplacoes WHERE empresa_id = p_empresa_id AND venda_id = p_venda_id;
    DELETE FROM public.cotas_definitivas WHERE empresa_id = p_empresa_id AND venda_id = p_venda_id;
    DELETE FROM public.vendas WHERE empresa_id = p_empresa_id AND id = p_venda_id;
  END IF;

  IF v_contratacao_id IS NOT NULL THEN
    UPDATE public.contratacoes_online
    SET status_operacional_erp = 'PRONTO_FORMALIZAR', finalizado_em = NULL
    WHERE id = v_contratacao_id AND empresa_id = p_empresa_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'acao', CASE WHEN v_tem_historico THEN 'EXCLUIR_COM_REVERSAO' ELSE 'EXCLUIR' END,
    'venda_id', p_venda_id,
    'itens_repasse_reabertos', v_itens_reabertos,
    'historico_preservado', v_tem_historico
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_master_excluir_ou_estornar_venda(uuid,uuid,text,boolean,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_master_excluir_ou_estornar_venda(uuid,uuid,text,boolean,text)
  TO authenticated, service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
