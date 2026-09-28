-- Teto mensal opcional por centro de custo. Sem teto, o centro não gera alerta.
alter table public.financeiro_centros_custo
  add column if not exists limite_mensal numeric(15,2);

alter table public.financeiro_centros_custo
  drop constraint if exists financeiro_centros_custo_limite_mensal_check;

alter table public.financeiro_centros_custo
  add constraint financeiro_centros_custo_limite_mensal_check
  check (limite_mensal is null or limite_mensal > 0);

comment on column public.financeiro_centros_custo.limite_mensal is
  'Teto mensal de despesas operacionais pagas, pela data de pagamento, por centro de custo.';
