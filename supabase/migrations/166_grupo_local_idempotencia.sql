-- 166 — Bloqueia duplicação de grupo local causada por reenvio do mesmo formulário.
BEGIN;

CREATE OR REPLACE FUNCTION public.trg_bloquear_grupo_local_duplicado()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.origem_governanca = 'LOCAL' AND NEW.empresa_origem_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      NEW.empresa_origem_id::text || ':' || coalesce(NEW.administradora_id::text, '') || ':' || upper(trim(NEW.codigo_grupo)), 0
    ));
    IF EXISTS (
      SELECT 1 FROM public.grupos_consorcio g
      WHERE g.empresa_origem_id = NEW.empresa_origem_id
        AND g.administradora_id IS NOT DISTINCT FROM NEW.administradora_id
        AND upper(trim(g.codigo_grupo)) = upper(trim(NEW.codigo_grupo))
        AND g.origem_governanca = 'LOCAL'
        AND g.id IS DISTINCT FROM NEW.id
    ) THEN
      RAISE EXCEPTION 'Grupo local % já cadastrado nesta empresa', NEW.codigo_grupo USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grupos_consorcio_bloquear_local_duplicado ON public.grupos_consorcio;
CREATE TRIGGER grupos_consorcio_bloquear_local_duplicado
BEFORE INSERT OR UPDATE OF codigo_grupo, administradora_id, empresa_origem_id, origem_governanca
ON public.grupos_consorcio FOR EACH ROW EXECUTE FUNCTION public.trg_bloquear_grupo_local_duplicado();

COMMENT ON FUNCTION public.trg_bloquear_grupo_local_duplicado() IS
  'Serializa e bloqueia cadastros locais repetidos por empresa, administradora e código normalizado.';
COMMIT;
