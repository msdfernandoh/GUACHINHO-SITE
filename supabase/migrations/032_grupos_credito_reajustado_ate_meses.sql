-- Controla destaque de reajuste de crédito a cada 12 meses (12, 24, 36, 48…)

alter table public.grupos_consorcio
  add column if not exists credito_reajustado_ate_meses integer not null default 0;

comment on column public.grupos_consorcio.credito_reajustado_ate_meses is
  'Último marco de 12 meses (12/24/36…) em que o crédito das cotas foi reajustado. Destaque na lista enquanto o prazo atual ultrapassar este valor.';
