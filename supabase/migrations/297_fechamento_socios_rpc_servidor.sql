-- 297: fechamento somente pela action autenticada do servidor.
-- O demonstrativo contém valores conferidos pelo gestor e não pode ser
-- enviado diretamente pelo navegador à RPC de gravação.
BEGIN;

REVOKE ALL ON FUNCTION public.rpc_fechar_socios(uuid,date,date,text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_registrar_fechamento_socios_corte(uuid,date,date,jsonb,text,text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_registrar_fechamento_socios_corte_servidor(
  p_empresa_id uuid, p_periodo_inicio date, p_periodo_fim date,
  p_demonstrativo jsonb, p_observacoes text, p_idempotency_key text,
  p_auth_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_usuario uuid;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
    OR p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'O fechamento só pode ser registrado pelo servidor autorizado';
  END IF;
  SELECT u.id INTO v_usuario
  FROM public.usuarios u
  JOIN public.empresa_usuarios eu ON eu.usuario_id = u.id
  WHERE u.auth_user_id = p_auth_user_id AND u.ativo
    AND eu.empresa_id = p_empresa_id AND eu.ativo
  LIMIT 1;
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'Usuário sem vínculo ativo com a empresa';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', p_auth_user_id::text, true);
  RETURN public.rpc_registrar_fechamento_socios_corte(
    p_empresa_id, p_periodo_inicio, p_periodo_fim,
    p_demonstrativo, p_observacoes, p_idempotency_key);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_registrar_fechamento_socios_corte_servidor(uuid,date,date,jsonb,text,text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_fechamento_socios_corte_servidor(uuid,date,date,jsonb,text,text,uuid)
  TO service_role;
COMMIT;
