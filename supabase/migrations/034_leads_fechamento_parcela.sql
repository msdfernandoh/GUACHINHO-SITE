-- Dados de parcela no fechamento comercial (agenda / CRM)

alter table public.leads
  add column if not exists fechamento_tipo_parcela text,
  add column if not exists fechamento_percentual_parcela numeric(5, 2),
  add column if not exists valor_parcela_fechamento numeric(15, 2);

comment on column public.leads.fechamento_tipo_parcela is 'integral ou reduzida — registrado ao concluir compromisso com ganho';
comment on column public.leads.fechamento_percentual_parcela is 'Percentual da parcela reduzida (ex.: 60) quando tipo reduzida';
comment on column public.leads.valor_parcela_fechamento is 'Valor da parcela informado no fechamento (opcional)';
