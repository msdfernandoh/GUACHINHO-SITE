-- Configuração opcional por evento; preserva contatos e clientes existentes.
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS whatsapp_equipe text;
COMMENT ON COLUMN public.eventos.whatsapp_equipe IS 'WhatsApp BR da equipe com DDD, sem +55; NULL mantém contato padrão do check-in.';
NOTIFY pgrst, 'reload schema';
