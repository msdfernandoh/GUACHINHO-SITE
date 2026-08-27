-- 143 — Normaliza nomenclatura histórica de limite de domínios de parceiros.
BEGIN;
DO $$ DECLARE v_nome text; v_oid oid; v_def text;
BEGIN
  FOREACH v_nome IN ARRAY ARRAY['rpc_platform_criar_override','rpc_platform_encerrar_override'] LOOP
    SELECT p.oid INTO v_oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=v_nome LIMIT 1;
    IF v_oid IS NOT NULL THEN
      v_def:=pg_get_functiondef(v_oid);
      v_def:=replace(v_def,'limite_dominios_proprios','max_sites_dominio_proprio');
      v_def:=replace(v_def,'dominios_proprios_contratados','sites_dominio_proprio_contratados');
      EXECUTE v_def;
    END IF;
  END LOOP;
END $$;
COMMIT;
NOTIFY pgrst,'reload schema';
