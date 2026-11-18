BEGIN;

ALTER TABLE public.spl_imobiliarias
  ADD COLUMN IF NOT EXISTS termos_modelo text;

UPDATE public.spl_imobiliarias
SET termos_modelo = modelo_parceria
WHERE termos_aceito_em IS NOT NULL AND termos_modelo IS NULL;

ALTER TABLE public.spl_vendedores
  ADD COLUMN IF NOT EXISTS termos_versao text,
  ADD COLUMN IF NOT EXISTS termos_aceito_em timestamptz,
  ADD COLUMN IF NOT EXISTS termos_aceite_ip text,
  ADD COLUMN IF NOT EXISTS termos_aceite_agente text;

COMMIT;
