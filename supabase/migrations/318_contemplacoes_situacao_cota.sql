-- ==============================================================================
-- Migration 312: Adicionar situacao_cota e flexibilizar colunas
-- ==============================================================================

ALTER TABLE public.grupo_assembleias_contemplacoes
  ADD COLUMN IF NOT EXISTS situacao_cota TEXT DEFAULT 'ATIVA',
  ALTER COLUMN codigo_grupo DROP NOT NULL,
  ALTER COLUMN assembleia_data DROP NOT NULL;

-- Garante permissões completas para service_role e usuários autenticados
GRANT ALL ON TABLE public.grupo_assembleias_contemplacoes TO service_role;
GRANT SELECT ON TABLE public.grupo_assembleias_contemplacoes TO authenticated, anon;
