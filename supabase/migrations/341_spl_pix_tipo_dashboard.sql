-- Portfólio SPL: tipo da chave PIX (celular, CPF, CNPJ, e-mail, aleatória) e
-- token do painel somente leitura da SPL Engenharia. Alterações aditivas.

ALTER TABLE public.spl_imobiliarias
  ADD COLUMN IF NOT EXISTS chave_pix_tipo text
  CHECK (chave_pix_tipo IS NULL OR chave_pix_tipo IN ('CELULAR', 'CPF', 'CNPJ', 'EMAIL', 'ALEATORIA'));

ALTER TABLE public.spl_vendedores
  ADD COLUMN IF NOT EXISTS chave_pix_tipo text
  CHECK (chave_pix_tipo IS NULL OR chave_pix_tipo IN ('CELULAR', 'CPF', 'CNPJ', 'EMAIL', 'ALEATORIA'));

-- CNPJ opcional: o cadastro entra e fica marcado como incompleto até o envio.
ALTER TABLE public.spl_imobiliarias DROP CONSTRAINT IF EXISTS spl_imobiliarias_pix_chk;
ALTER TABLE public.spl_imobiliarias ADD CONSTRAINT spl_imobiliarias_pix_chk CHECK (
  modelo_parceria = 'SOMENTE_LIBERAR_CARTEIRA' OR char_length(trim(coalesce(chave_pix, ''))) BETWEEN 3 AND 140
);

INSERT INTO public.configuracoes_sistema (chave, valor)
VALUES ('spl_dashboard', jsonb_build_object('token', md5(random()::text || clock_timestamp()::text)))
ON CONFLICT (chave) DO NOTHING;
