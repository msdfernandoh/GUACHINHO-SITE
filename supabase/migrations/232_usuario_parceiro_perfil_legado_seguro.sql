-- 232: Perfil legado explícito para parceiros autenticados.
-- Preserva perfis existentes e evita conceder privilégios de SRD ao indicador.
BEGIN;
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_perfil_check;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_perfil_check
  CHECK (perfil IN ('master', 'srd', 'imobiliaria', 'visualizador', 'parceiro'));
COMMIT;
NOTIFY pgrst, 'reload schema';
