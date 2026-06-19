-- Fase 10 — Funil comercial, atividades e campos CRM em leads

alter table public.leads
  add column if not exists temperatura text,
  add column if not exists proxima_acao text,
  add column if not exists data_proxima_acao timestamptz,
  add column if not exists observacao_perda text,
  add column if not exists valor_estimado numeric(15, 2),
  add column if not exists ultima_interacao_at timestamptz,
  add column if not exists fechado_at timestamptz,
  add column if not exists perdido_at timestamptz,
  add column if not exists observacao_fechamento text;

create index if not exists leads_temperatura_idx on public.leads (temperatura);
create index if not exists leads_data_proxima_acao_idx on public.leads (data_proxima_acao);
create index if not exists leads_ultima_interacao_idx on public.leads (ultima_interacao_at);

-- Atividades / follow-ups
create table if not exists public.lead_atividades (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  usuario_id uuid references public.usuarios (id) on delete set null,
  tipo text not null,
  titulo text,
  descricao text,
  status text not null default 'pendente',
  data_agendada timestamptz,
  data_conclusao timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_atividades_lead_id_idx on public.lead_atividades (lead_id);
create index if not exists lead_atividades_status_idx on public.lead_atividades (status, data_agendada);

alter table public.lead_atividades enable row level security;

drop policy if exists lead_atividades_staff_all on public.lead_atividades;
create policy lead_atividades_staff_all on public.lead_atividades
  for all to authenticated
  using (
    exists (
      select 1 from public.usuarios u
      where u.auth_user_id = auth.uid()
        and u.ativo = true
        and lower(u.perfil) in ('master', 'srd', 'visualizador')
    )
  )
  with check (
    exists (
      select 1 from public.usuarios u
      where u.auth_user_id = auth.uid()
        and u.ativo = true
        and lower(u.perfil) in ('master', 'srd', 'visualizador')
    )
  );

drop trigger if exists lead_atividades_updated_at on public.lead_atividades;
create trigger lead_atividades_updated_at before update on public.lead_atividades
  for each row execute function public.set_updated_at();
