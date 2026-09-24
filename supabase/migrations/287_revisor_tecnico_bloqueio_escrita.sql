-- Bloqueio transversal de DML para sessões da revisão técnica.
-- A identidade neutra não participa de empresa_usuarios; este guard cobre
-- políticas históricas que concedem escrita ampla ao papel authenticated.
BEGIN;

CREATE OR REPLACE FUNCTION public.bloquear_escrita_revisor_tecnico()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF public.is_platform_technical_reviewer() THEN
    RAISE EXCEPTION 'Acesso de revisão técnica é somente leitura.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.bloquear_escrita_revisor_tecnico() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE rec record;
BEGIN
  FOR rec IN
    SELECT n.nspname, c.relname
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relispartition
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.bloquear_escrita_revisor_tecnico()',
      'bloquear_revisor_tecnico', rec.nspname, rec.relname);
  END LOOP;
END $$;

COMMIT;
