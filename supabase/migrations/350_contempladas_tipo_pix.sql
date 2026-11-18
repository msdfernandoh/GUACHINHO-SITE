-- Tipo da chave PIX do portal contempladas (máscara e validação na tela).
ALTER TABLE public.contempladas_config
  ADD COLUMN IF NOT EXISTS chave_pix_tipo text NOT NULL DEFAULT 'CELULAR'
  CHECK (chave_pix_tipo IN ('CELULAR', 'EMAIL', 'CPF', 'CNPJ', 'ALEATORIA'));
