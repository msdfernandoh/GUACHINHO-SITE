-- 285 — Reserva fiscal automática formada pelos impostos de comissões recebidas.
-- O marcador explícito evita que uma conta tributária reduza a reserva por engano.

BEGIN;

ALTER TABLE public.financeiro_contas_pagar
  ADD COLUMN IF NOT EXISTS retirar_reserva_impostos boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.financeiro_contas_pagar.retirar_reserva_impostos IS
  'Quando paga, baixa o controle da reserva fiscal formada pelos impostos das comissões recebidas.';

CREATE INDEX IF NOT EXISTS financeiro_contas_pagar_reserva_impostos_idx
  ON public.financeiro_contas_pagar (empresa_id, status)
  WHERE retirar_reserva_impostos;

COMMIT;

NOTIFY pgrst, 'reload schema';
