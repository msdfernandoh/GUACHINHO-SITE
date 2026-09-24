-- 283 — O responsável financeiro/master pode confirmar a baixa recebida por
-- outro participante. A autoria continua preservada em
-- conferido_por_usuario_id, portanto não se confunde com a declaração feita
-- pelo próprio beneficiário.

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_conferir_pagamento_participante(
  p_empresa_id uuid,
  p_previsao_participante_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_prev record;
  v_usuario uuid := public.current_usuario_id();
  v_proprio_beneficiario boolean := false;
  v_financeiro boolean := false;
BEGIN
  SELECT p.*, pc.usuario_id
  INTO v_prev
  FROM public.comissao_previsoes_participantes p
  JOIN public.participantes_comerciais pc
    ON pc.id = p.participante_comercial_id AND pc.empresa_id = p.empresa_id
  WHERE p.id = p_previsao_participante_id AND p.empresa_id = p_empresa_id
  FOR UPDATE;

  IF v_prev.id IS NULL THEN
    RAISE EXCEPTION 'Previsão não encontrada nesta empresa';
  END IF;

  v_proprio_beneficiario := v_prev.usuario_id IS NOT DISTINCT FROM v_usuario;
  v_financeiro := public.has_company_permission(p_empresa_id, 'gerenciar_financeiro');
  IF NOT v_proprio_beneficiario AND NOT v_financeiro THEN
    RAISE EXCEPTION 'Somente o beneficiário ou o responsável financeiro pode confirmar este pagamento';
  END IF;
  IF COALESCE(v_prev.valor_pago, 0) <= 0 THEN
    RAISE EXCEPTION 'A empresa ainda não registrou pagamento para esta previsão';
  END IF;
  IF v_prev.conferido_por_participante THEN
    RETURN jsonb_build_object('previsao_id', v_prev.id, 'reused', true);
  END IF;

  UPDATE public.comissao_previsoes_participantes
  SET conferido_por_participante = true,
      conferido_em = now(),
      conferido_por_usuario_id = v_usuario,
      updated_at = now()
  WHERE id = v_prev.id;

  RETURN jsonb_build_object(
    'previsao_id', v_prev.id,
    'reused', false,
    'conferido_pelo_financeiro', NOT v_proprio_beneficiario
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_conferir_pagamento_participante(uuid, uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_conferir_pagamento_participante(uuid, uuid)
  TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
