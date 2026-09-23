-- Edição rápida de leads no pipeline: tags estruturadas, sem alterar dados existentes.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.leads.tags IS 'Tags comerciais livres do lead, normalizadas pela interface do CRM.';
