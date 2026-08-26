-- 119: Flag descontado_comissao em centros de custo e contas a pagar para evitar duplicidade de impostos
BEGIN;

ALTER TABLE public.financeiro_centros_custo
  ADD COLUMN IF NOT EXISTS descontado_comissao boolean NOT NULL DEFAULT false;

ALTER TABLE public.financeiro_contas_pagar
  ADD COLUMN IF NOT EXISTS descontado_comissao boolean NOT NULL DEFAULT false;

COMMIT;

NOTIFY pgrst, 'reload schema';
