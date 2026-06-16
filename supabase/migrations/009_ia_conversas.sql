-- Fase 8 — IA comercial: conversas e mensagens

create table if not exists public.ia_conversas (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete set null,
  session_id text not null,
  nome_visitante text,
  whatsapp_visitante text,
  pagina_origem text,
  url_origem text,
  interesse_identificado text,
  resumo text,
  status text not null default 'ativa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ia_conversas_session_idx on public.ia_conversas (session_id);
create index if not exists ia_conversas_lead_idx on public.ia_conversas (lead_id);

create table if not exists public.ia_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.ia_conversas (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists ia_mensagens_conversa_idx on public.ia_mensagens (conversa_id);

alter table public.ia_conversas enable row level security;
alter table public.ia_mensagens enable row level security;

create policy ia_conversas_staff on public.ia_conversas for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy ia_mensagens_staff on public.ia_mensagens for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create trigger ia_conversas_updated_at before update on public.ia_conversas
  for each row execute function public.set_updated_at();
