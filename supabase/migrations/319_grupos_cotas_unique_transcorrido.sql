-- Migration 319: Adiciona restrição de unicidade para grupo_id, valor_credito e tipo_transcorrido em grupos_cotas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'grupos_cotas_grupo_credito_transcorrido_key'
  ) THEN
    ALTER TABLE public.grupos_cotas
      ADD CONSTRAINT grupos_cotas_grupo_credito_transcorrido_key
      UNIQUE (grupo_id, valor_credito, tipo_transcorrido);
  END IF;
END $$;
