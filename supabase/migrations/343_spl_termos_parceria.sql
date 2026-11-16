-- Portfólio SPL: aceite do termo de parceria pelas imobiliárias (versão, data,
-- IP e navegador). O texto fica em configuracoes_sistema.spl_termos.
ALTER TABLE public.spl_imobiliarias
  ADD COLUMN IF NOT EXISTS termos_versao text,
  ADD COLUMN IF NOT EXISTS termos_aceito_em timestamptz,
  ADD COLUMN IF NOT EXISTS termos_aceite_ip text,
  ADD COLUMN IF NOT EXISTS termos_aceite_agente text;
