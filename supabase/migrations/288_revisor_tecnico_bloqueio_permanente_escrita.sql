-- A expiração revoga a visualização, mas não deve remover a proteção de escrita.
BEGIN;

CREATE OR REPLACE FUNCTION public.bloquear_escrita_revisor_tecnico()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.plataforma_revisores_tecnicos r
    WHERE r.usuario_id = public.current_usuario_id()
  ) THEN
    RAISE EXCEPTION 'Acesso de revisão técnica é somente leitura.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

COMMIT;
