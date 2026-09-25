-- RPCs SECURITY DEFINER so podem ser chamadas pelo servidor.
-- Leads legados sem empresa pertencem somente a Gauchinho.
BEGIN;

ALTER FUNCTION public.rpc_adotar_lead_legado_e_upsert_por_telefone(jsonb)
  RENAME TO rpc_adotar_lead_legado_e_upsert_por_telefone_impl;

CREATE FUNCTION public.rpc_adotar_lead_legado_e_upsert_por_telefone(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid;
  v_gauchinho_id uuid;
BEGIN
  v_empresa_id := nullif(p_payload->>'empresa_id', '')::uuid;
  SELECT id INTO STRICT v_gauchinho_id FROM public.empresas WHERE slug = 'gauchinho';

  IF v_empresa_id IS DISTINCT FROM v_gauchinho_id THEN
    RETURN public.rpc_upsert_lead_por_telefone(p_payload);
  END IF;

  RETURN public.rpc_adotar_lead_legado_e_upsert_por_telefone_impl(p_payload);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_upsert_lead_por_telefone(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_lead_por_telefone(jsonb)
  TO service_role;

REVOKE ALL ON FUNCTION public.rpc_adotar_lead_legado_e_upsert_por_telefone_impl(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_adotar_lead_legado_e_upsert_por_telefone_impl(jsonb)
  TO service_role;

REVOKE ALL ON FUNCTION public.rpc_adotar_lead_legado_e_upsert_por_telefone(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_adotar_lead_legado_e_upsert_por_telefone(jsonb)
  TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
