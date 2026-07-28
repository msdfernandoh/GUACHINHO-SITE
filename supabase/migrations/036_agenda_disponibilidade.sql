-- Disponibilidade semanal dos consultores (para SDRs agendarem)

create table if not exists public.agenda_disponibilidade (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  -- 0 = domingo … 6 = sábado (mesmo padrão de Date.getDay())
  dia_semana smallint not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fim time not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agenda_disponibilidade_horario_check check (hora_fim > hora_inicio)
);

create index if not exists agenda_disponibilidade_usuario_idx
  on public.agenda_disponibilidade (usuario_id, dia_semana);

create table if not exists public.agenda_disponibilidade_meta (
  usuario_id uuid primary key references public.usuarios (id) on delete cascade,
  observacao text,
  updated_at timestamptz not null default now()
);

comment on table public.agenda_disponibilidade is 'Janelas livres semanais do consultor para agendamento pelo SDR.';
comment on table public.agenda_disponibilidade_meta is 'Observações gerais de disponibilidade por consultor.';

alter table public.agenda_disponibilidade enable row level security;
alter table public.agenda_disponibilidade_meta enable row level security;

drop policy if exists agenda_disp_select on public.agenda_disponibilidade;
create policy agenda_disp_select on public.agenda_disponibilidade for select to authenticated
  using (public.is_master() or public.is_staff());

drop policy if exists agenda_disp_write_own on public.agenda_disponibilidade;
create policy agenda_disp_write_own on public.agenda_disponibilidade for all to authenticated
  using (
    public.is_master()
    or usuario_id = (select u.id from public.usuarios u where u.auth_user_id = auth.uid() limit 1)
  )
  with check (
    public.is_master()
    or usuario_id = (select u.id from public.usuarios u where u.auth_user_id = auth.uid() limit 1)
  );

drop policy if exists agenda_disp_meta_select on public.agenda_disponibilidade_meta;
create policy agenda_disp_meta_select on public.agenda_disponibilidade_meta for select to authenticated
  using (public.is_master() or public.is_staff());

drop policy if exists agenda_disp_meta_write_own on public.agenda_disponibilidade_meta;
create policy agenda_disp_meta_write_own on public.agenda_disponibilidade_meta for all to authenticated
  using (
    public.is_master()
    or usuario_id = (select u.id from public.usuarios u where u.auth_user_id = auth.uid() limit 1)
  )
  with check (
    public.is_master()
    or usuario_id = (select u.id from public.usuarios u where u.auth_user_id = auth.uid() limit 1)
  );

drop trigger if exists agenda_disponibilidade_updated_at on public.agenda_disponibilidade;
create trigger agenda_disponibilidade_updated_at before update on public.agenda_disponibilidade
  for each row execute function public.set_updated_at();
