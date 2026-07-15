-- Parcela reduzida personalizada (promoções pontuais por grupo)
ALTER TABLE grupos_consorcio
  ADD COLUMN IF NOT EXISTS permite_parcela_reduzida_personalizada boolean NOT NULL DEFAULT false;

ALTER TABLE grupos_consorcio
  ADD COLUMN IF NOT EXISTS percentual_parcela_reduzida_personalizada numeric;
