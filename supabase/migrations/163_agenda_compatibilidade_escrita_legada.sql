-- Fase 162 - ponte de compatibilidade para a versão anterior da aplicação.
-- A origem continua determinística e falha fechada em vínculos ambíguos.

BEGIN;

CREATE OR REPLACE FUNCTION public.validar_agenda_compromisso_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_empresas uuid[];
BEGIN
  IF NEW.empresa_id IS NULL AND NEW.lead_id IS NOT NULL THEN
    SELECT l.empresa_id INTO NEW.empresa_id
    FROM public.leads l
    WHERE l.id = NEW.lead_id;
  END IF;

  IF NEW.empresa_id IS NULL AND NEW.consultor_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT eu.empresa_id) INTO v_empresas
    FROM public.empresa_usuarios eu
    WHERE eu.usuario_id = NEW.consultor_id AND eu.ativo = true;

    IF coalesce(array_length(v_empresas, 1), 0) = 1 THEN
      NEW.empresa_id := v_empresas[1];
    END IF;
  END IF;

  IF NEW.empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa da agenda ausente ou ambigua.';
  END IF;

  IF NEW.lead_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = NEW.lead_id AND l.empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Lead nao pertence a empresa da agenda.';
  END IF;

  IF NEW.consultor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.empresa_id = NEW.empresa_id
      AND eu.usuario_id = NEW.consultor_id
      AND eu.ativo = true
  ) THEN
    RAISE EXCEPTION 'Responsavel nao possui vinculo ativo com a empresa da agenda.';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.criado_por_usuario_id IS NULL THEN
    NEW.criado_por_usuario_id := public.current_usuario_id();
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
