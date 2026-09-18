BEGIN;

ALTER TABLE public.programa_indicadores
  ADD COLUMN IF NOT EXISTS ja_vende_consorcio text,
  ADD COLUMN IF NOT EXISTS rede_relacionamento text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS potencial_mensal text,
  ADD COLUMN IF NOT EXISTS interesse_network text,
  ADD COLUMN IF NOT EXISTS origem_cadastro text NOT NULL DEFAULT 'LANDING_PARCEIROS',
  ADD COLUMN IF NOT EXISTS pagina_origem text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text;

CREATE INDEX IF NOT EXISTS programa_indicadores_origem_cadastro_idx
  ON public.programa_indicadores (empresa_id, origem_cadastro, created_at DESC);

COMMIT;

NOTIFY pgrst, 'reload schema';
