BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_ajustar_previsao_participante_manual(
  p_empresa_id uuid,
  p_previsao_id uuid,
  p_valor_previsto numeric,
  p_valor_elegivel numeric,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_previsao public.comissao_previsoes_participantes%ROWTYPE;
  v_usuario_id uuid;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.can_write_tenant_internal(p_empresa_id), false) THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;
  IF v_motivo = '' OR length(v_motivo) < 5 THEN
    RAISE EXCEPTION 'Informe um motivo com pelo menos 5 caracteres';
  END IF;
  IF p_valor_previsto IS NULL OR p_valor_elegivel IS NULL
     OR p_valor_previsto < 0 OR p_valor_elegivel < 0
     OR p_valor_elegivel > p_valor_previsto THEN
    RAISE EXCEPTION 'Valores inválidos: disponível deve ficar entre zero e o valor gerado';
  END IF;

  SELECT * INTO v_previsao
  FROM public.comissao_previsoes_participantes
  WHERE id = p_previsao_id AND empresa_id = p_empresa_id
  FOR UPDATE;

  IF v_previsao.id IS NULL THEN RAISE EXCEPTION 'Previsão não encontrada'; END IF;
  IF v_previsao.status IN ('cancelada', 'suspensa') THEN
    RAISE EXCEPTION 'Previsão cancelada ou suspensa não pode ser ajustada por este fluxo';
  END IF;
  IF p_valor_previsto < v_previsao.valor_pago OR p_valor_elegivel < v_previsao.valor_pago THEN
    RAISE EXCEPTION 'O ajuste não pode ficar abaixo do valor já pago (%)', v_previsao.valor_pago;
  END IF;

  v_status := CASE
    WHEN v_previsao.valor_pago > 0 AND v_previsao.valor_pago = p_valor_elegivel THEN 'paga'
    WHEN v_previsao.valor_pago > 0 THEN 'parcialmente_paga'
    WHEN p_valor_elegivel = p_valor_previsto AND p_valor_previsto > 0 THEN 'elegivel'
    WHEN p_valor_elegivel > 0 THEN 'parcialmente_elegivel'
    ELSE 'prevista'
  END;

  UPDATE public.comissao_previsoes_participantes
  SET valor_previsto = round(p_valor_previsto, 2),
      valor_elegivel = round(p_valor_elegivel, 2),
      status = v_status,
      snapshot_regra = coalesce(snapshot_regra, '{}'::jsonb) || jsonb_build_object(
        'ultimo_ajuste_manual', jsonb_build_object(
          'valor_previsto_anterior', v_previsao.valor_previsto,
          'valor_elegivel_anterior', v_previsao.valor_elegivel,
          'valor_previsto_novo', round(p_valor_previsto, 2),
          'valor_elegivel_novo', round(p_valor_elegivel, 2),
          'motivo', v_motivo,
          'usuario_auth_id', auth.uid(),
          'ajustado_em', now()
        )
      ),
      updated_at = now()
  WHERE id = v_previsao.id;

  SELECT id INTO v_usuario_id FROM public.usuarios WHERE auth_user_id = auth.uid() LIMIT 1;
  INSERT INTO public.audit_logs_central(
    empresa_id, usuario_id, modulo, acao, entidade_tipo, entidade_id, detalhes,
    correlation_id, origem, resultado
  ) VALUES (
    p_empresa_id, v_usuario_id, 'comissoes', 'ajuste_manual_elegibilidade',
    'comissao_previsoes_participantes', v_previsao.id,
    jsonb_build_object(
      'motivo', v_motivo,
      'valor_previsto_anterior', v_previsao.valor_previsto,
      'valor_elegivel_anterior', v_previsao.valor_elegivel,
      'valor_pago_preservado', v_previsao.valor_pago,
      'valor_previsto_novo', round(p_valor_previsto, 2),
      'valor_elegivel_novo', round(p_valor_elegivel, 2)
    ),
    'ajuste-manual:' || v_previsao.id::text || ':' || extract(epoch from clock_timestamp())::bigint,
    'erp_comissoes_empresa', 'SUCESSO'
  );

  RETURN jsonb_build_object(
    'previsao_id', v_previsao.id,
    'valor_previsto', round(p_valor_previsto, 2),
    'valor_elegivel', round(p_valor_elegivel, 2),
    'valor_pago', v_previsao.valor_pago,
    'status', v_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_ajustar_previsao_participante_manual(uuid,uuid,numeric,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_ajustar_previsao_participante_manual(uuid,uuid,numeric,numeric,text) TO authenticated, service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
