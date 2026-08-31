-- Fase 162 - compatibilidade temporaria da disponibilidade com o runtime anterior.

BEGIN;

CREATE OR REPLACE FUNCTION public.agenda_inferir_empresa_usuario_legado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_empresas uuid[];
BEGIN
  IF NEW.empresa_id IS NULL THEN
    SELECT array_agg(DISTINCT eu.empresa_id) INTO v_empresas
    FROM public.empresa_usuarios eu
    WHERE eu.usuario_id = NEW.usuario_id AND eu.ativo = true;

    IF coalesce(array_length(v_empresas, 1), 0) = 1 THEN
      NEW.empresa_id := v_empresas[1];
    ELSE
      RAISE EXCEPTION 'Empresa da disponibilidade ausente ou ambigua.';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.empresa_id = NEW.empresa_id
      AND eu.usuario_id = NEW.usuario_id
      AND eu.ativo = true
  ) THEN
    RAISE EXCEPTION 'Usuario nao pertence a empresa da disponibilidade.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agenda_disponibilidade_empresa ON public.agenda_disponibilidade;
CREATE TRIGGER trg_agenda_disponibilidade_empresa
BEFORE INSERT OR UPDATE OF empresa_id, usuario_id ON public.agenda_disponibilidade
FOR EACH ROW EXECUTE FUNCTION public.agenda_inferir_empresa_usuario_legado();

DROP TRIGGER IF EXISTS trg_agenda_disponibilidade_meta_empresa ON public.agenda_disponibilidade_meta;
CREATE TRIGGER trg_agenda_disponibilidade_meta_empresa
BEFORE INSERT OR UPDATE OF empresa_id, usuario_id ON public.agenda_disponibilidade_meta
FOR EACH ROW EXECUTE FUNCTION public.agenda_inferir_empresa_usuario_legado();

DROP TRIGGER IF EXISTS trg_agenda_bloqueios_empresa ON public.agenda_bloqueios;
CREATE TRIGGER trg_agenda_bloqueios_empresa
BEFORE INSERT OR UPDATE OF empresa_id, usuario_id ON public.agenda_bloqueios
FOR EACH ROW EXECUTE FUNCTION public.agenda_inferir_empresa_usuario_legado();

-- Mantem o ON CONFLICT(usuario_id) usado pelo runtime anterior ate sua substituicao.
CREATE UNIQUE INDEX IF NOT EXISTS agenda_disponibilidade_meta_usuario_legacy_uidx
  ON public.agenda_disponibilidade_meta(usuario_id);

NOTIFY pgrst, 'reload schema';
COMMIT;
