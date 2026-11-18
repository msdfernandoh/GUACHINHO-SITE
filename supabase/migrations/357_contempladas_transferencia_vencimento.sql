-- Taxa de transferência por cota (lida no envio) ou padrão da unidade (imóvel/veículo) e dia de vencimento das mensagens.
ALTER TABLE public.contempladas_cotas ADD COLUMN IF NOT EXISTS transferencia numeric(15,2);
ALTER TABLE public.contempladas_config
  ADD COLUMN IF NOT EXISTS transferencia_imovel numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transferencia_auto numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dia_vencimento integer NOT NULL DEFAULT 10 CHECK (dia_vencimento BETWEEN 1 AND 31);
ALTER TABLE public.contempladas_gerente_config
  ADD COLUMN IF NOT EXISTS transferencia_imovel numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transferencia_auto numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dia_vencimento integer NOT NULL DEFAULT 10 CHECK (dia_vencimento BETWEEN 1 AND 31);
