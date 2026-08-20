-- 106 — Garantir colunas de participantes_comerciais e recarregar schema cache do PostgREST
BEGIN;

ALTER TABLE public.participantes_comerciais
  ADD COLUMN IF NOT EXISTS nome_exibicao text,
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS modulos_permitidos jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS escopo_visualizacao text DEFAULT 'TODOS';

DO $$
BEGIN
  ALTER TABLE public.participantes_comerciais
    DROP CONSTRAINT IF EXISTS participantes_comerciais_escopo_check;
  ALTER TABLE public.participantes_comerciais
    ADD CONSTRAINT participantes_comerciais_escopo_check
    CHECK (escopo_visualizacao IN ('TODOS', 'VINCULADOS', 'CRIADOS', 'VINCULADOS_OU_CRIADOS'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

COMMIT;

-- Recarregar cache do PostgREST
NOTIFY pgrst, 'reload schema';
