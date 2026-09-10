-- 217 — Atualização rápida de vagas de grupos em lote (SaaS Master)
BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_platform_atualizar_vagas_grupos_lote(
  p_updates jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_item jsonb;
  v_count integer := 0;
  v_vagas integer;
  v_id uuid;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin pode atualizar vagas em lote';
  END IF;

  IF jsonb_typeof(p_updates) <> 'array' THEN
    RAISE EXCEPTION 'Lista de atualizações inválida';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_updates)
  LOOP
    IF coalesce(v_item->>'id', '') !~* '^[0-9a-f-]{36}$' THEN
      RAISE EXCEPTION 'ID de grupo inválido na atualização em lote';
    END IF;

    v_id := (v_item->>'id')::uuid;
    v_vagas := greatest(0, coalesce((v_item->>'vagas_disponiveis')::integer, 0));

    UPDATE public.grupos_consorcio
    SET vagas_disponiveis = v_vagas,
        vagas_atualizado_em = now(),
        updated_at = now()
    WHERE id = v_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'atualizados', v_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_platform_atualizar_vagas_grupos_lote(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_platform_atualizar_vagas_grupos_lote(jsonb) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
