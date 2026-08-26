-- 135: impede dupla contabilização por fechamentos societários sobrepostos.
BEGIN;

CREATE OR REPLACE FUNCTION public.validar_periodo_fechamento_socios()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.empresa_id::text || ':FECHAMENTO_SOCIOS_PERIODO', 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.financeiro_fechamentos_socios f
    WHERE f.empresa_id = NEW.empresa_id
      AND daterange(f.periodo_inicio, f.periodo_fim, '[]')
          && daterange(NEW.periodo_inicio, NEW.periodo_fim, '[]')
  ) THEN
    RAISE EXCEPTION 'Já existe fechamento societário que sobrepõe o período informado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS financeiro_fechamentos_socios_validar_periodo
  ON public.financeiro_fechamentos_socios;
CREATE TRIGGER financeiro_fechamentos_socios_validar_periodo
BEFORE INSERT ON public.financeiro_fechamentos_socios
FOR EACH ROW EXECUTE FUNCTION public.validar_periodo_fechamento_socios();

REVOKE ALL ON FUNCTION public.validar_periodo_fechamento_socios()
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
