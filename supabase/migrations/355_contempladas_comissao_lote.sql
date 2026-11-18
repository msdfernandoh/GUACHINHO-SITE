-- Comissão da revenda definida no envio (vale para aquele lote) e pré-reserva padrão de 30 minutos.
ALTER TABLE public.contempladas_cotas
  ADD COLUMN IF NOT EXISTS comissao_fixada boolean NOT NULL DEFAULT false;
ALTER TABLE public.contempladas_config ALTER COLUMN pre_reserva_minutos SET DEFAULT 30;
UPDATE public.contempladas_config SET pre_reserva_minutos = 30 WHERE pre_reserva_minutos = 120;
