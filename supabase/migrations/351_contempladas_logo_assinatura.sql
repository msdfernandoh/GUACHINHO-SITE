-- Logomarca e telefone do gerente/vendedor na proposta (bloco de assinatura).
ALTER TABLE public.contempladas_usuarios
  ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.contempladas_propostas
  ADD COLUMN IF NOT EXISTS vendedor_telefone text,
  ADD COLUMN IF NOT EXISTS vendedor_logo_url text;
