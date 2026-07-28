-- Disponibilidade por data específica, bloqueios e modalidade de atendimento

alter table public.agenda_disponibilidade
  add column if not exists data_especifica date,
  add column if not exists modalidade_atendimento text not null default 'ambos';

alter table public.agenda_disponibilidade
  drop constraint if exists agenda_disponibilidade_modalidade_check;

alter table public.agenda_disponibilidade
  add constraint agenda_disponibilidade_modalidade_check
  check (modalidade_atendimento in ('presencial', 'online', 'ambos'));

-- Permite recorrência semanal (data_especifica null) OU data específica
alter table public.agenda_disponibilidade
  alter column dia_semana drop not null;

alter table public.agenda_disponibilidade
  drop constraint if exists agenda_disponibilidade_tipo_check;

alter table public.agenda_disponibilidade
  add constraint agenda_disponibilidade_tipo_check
  check (
    (data_especifica is not null)
    or (dia_semana is not null and dia_semana between 0 and 6)
  );

create index if not exists agenda_disponibilidade_data_idx
  on public.agenda_disponibilidade (usuario_id, data_especifica)
  where data_especifica is not null;

alter table public.agenda_disponibilidade_meta
  add column if not exists modalidade_padrao text not null default 'ambos';

alter table public.agenda_disponibilidade_meta
  drop constraint if exists agenda_disp_meta_modalidade_check;

alter table public.agenda_disponibilidade_meta
  add constraint agenda_disp_meta_modalidade_check
  check (modalidade_padrao in ('presencial', 'online', 'ambos'));

create table if not exists public.agenda_bloqueios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  data_inicio date not null,
  data_fim date not null,
  hora_inicio time,
  hora_fim time,
  motivo text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agenda_bloqueios_periodo_check check (data_fim >= data_inicio)
);

create index if not exists agenda_bloqueios_usuario_idx
  on public.agenda_bloqueios (usuario_id, data_inicio, data_fim);

comment on table public.agenda_bloqueios is 'Períodos fechados na agenda do consultor, com motivo.';

alter table public.agenda_bloqueios enable row level security;

drop policy if exists agenda_bloqueios_select on public.agenda_bloqueios;
create policy agenda_bloqueios_select on public.agenda_bloqueios for select to authenticated
  using (public.is_master() or public.is_staff());

drop policy if exists agenda_bloqueios_write_own on public.agenda_bloqueios;
create policy agenda_bloqueios_write_own on public.agenda_bloqueios for all to authenticated
  using (
    public.is_master()
    or usuario_id = (select u.id from public.usuarios u where u.auth_user_id = auth.uid() limit 1)
  )
  with check (
    public.is_master()
    or usuario_id = (select u.id from public.usuarios u where u.auth_user_id = auth.uid() limit 1)
  );

drop trigger if exists agenda_bloqueios_updated_at on public.agenda_bloqueios;
create trigger agenda_bloqueios_updated_at before update on public.agenda_bloqueios
  for each row execute function public.set_updated_at();

alter table public.agenda_compromissos
  add column if not exists modalidade_atendimento text;

alter table public.agenda_compromissos
  drop constraint if exists agenda_compromissos_modalidade_check;

alter table public.agenda_compromissos
  add constraint agenda_compromissos_modalidade_check
  check (
    modalidade_atendimento is null
    or modalidade_atendimento in ('presencial', 'online')
  );
