-- Identidade de avaliador sem vínculo tenant ou privilégios de escrita.
BEGIN;

CREATE TABLE public.plataforma_revisores_tecnicos (
  usuario_id uuid PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  expira_em timestamptz NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.plataforma_revisores_tecnicos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plataforma_revisores_tecnicos FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.plataforma_revisores_tecnicos TO service_role;

CREATE OR REPLACE FUNCTION public.is_platform_technical_reviewer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plataforma_revisores_tecnicos r
    WHERE r.usuario_id = public.current_usuario_id()
      AND r.ativo = true AND r.expira_em > now()
  );
$$;
REVOKE ALL ON FUNCTION public.is_platform_technical_reviewer() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_technical_reviewer() TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
