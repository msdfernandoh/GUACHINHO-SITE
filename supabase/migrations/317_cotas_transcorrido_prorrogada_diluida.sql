-- Migration 311: Suporte a Transcorrido (Prorrogada vs Diluída), Parcelas Flexíveis e Regras do Simulador Racon
-- 1. Colunas adicionais em grupos_consorcio
ALTER TABLE public.grupos_consorcio
  ADD COLUMN IF NOT EXISTS parcela_minima numeric(14,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tipo_pro_rata text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vencimento_dia text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS regras_contemplacao jsonb DEFAULT '[]'::jsonb;

-- 2. Colunas adicionais em grupos_cotas
ALTER TABLE public.grupos_cotas
  ADD COLUMN IF NOT EXISTS tipo_transcorrido text NOT NULL DEFAULT 'PRORROGADA',
  ADD COLUMN IF NOT EXISTS valor_transcorrido numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parcela_reduzida_50 numeric(14,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parcela_reduzida_60 numeric(14,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parcela_reduzida_70 numeric(14,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parcelas_reduzidas jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dados_simulacao jsonb DEFAULT '{}'::jsonb;

-- 3. Constraint de tipo_transcorrido se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'grupos_cotas_tipo_transcorrido_check'
  ) THEN
    ALTER TABLE public.grupos_cotas
      ADD CONSTRAINT grupos_cotas_tipo_transcorrido_check
      CHECK (tipo_transcorrido IN ('PRORROGADA', 'DILUIDA'));
  END IF;
END $$;

-- 4. Índices para busca performática por grupo e transcorrido
CREATE INDEX IF NOT EXISTS idx_grupos_cotas_grupo_transcorrido
  ON public.grupos_cotas (grupo_id, tipo_transcorrido);

CREATE INDEX IF NOT EXISTS idx_grupos_cotas_grupo_credito_transcorrido
  ON public.grupos_cotas (grupo_id, valor_credito, tipo_transcorrido);
