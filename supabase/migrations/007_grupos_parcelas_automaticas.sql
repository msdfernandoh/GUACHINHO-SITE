-- Atualização automática de parcelas realizadas / prazo restante por data base
alter table public.grupos_consorcio
  add column if not exists parcelas_realizadas_base integer,
  add column if not exists data_base_parcelas date,
  add column if not exists atualizacao_parcelas_automatica boolean not null default false;

comment on column public.grupos_consorcio.parcelas_realizadas_base is
  'Parcelas já realizadas na data_base_parcelas (base para cálculo automático).';
comment on column public.grupos_consorcio.data_base_parcelas is
  'Data em que parcelas_realizadas_base era válido.';
comment on column public.grupos_consorcio.atualizacao_parcelas_automatica is
  'Se true, realizadas/restantes são calculados em tempo real a partir da data base.';
