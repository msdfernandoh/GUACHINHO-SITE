-- Controle interno para distinguir contratos efetivados na lista do admin.
-- Idempotente: pode ser executada mais de uma vez.

alter table public.contratacoes_online
  add column if not exists contrato_assinado boolean not null default false,
  add column if not exists contrato_assinado_em timestamptz;

create index if not exists contratacoes_online_contrato_assinado_idx
  on public.contratacoes_online (contrato_assinado, created_at desc);

comment on column public.contratacoes_online.contrato_assinado is
  'Controle interno: indica que o contrato foi assinado/efetivado';

comment on column public.contratacoes_online.contrato_assinado_em is
  'Data e hora em que o contrato foi marcado como assinado no admin';

notify pgrst, 'reload schema';
