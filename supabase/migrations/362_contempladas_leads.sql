-- Leads do "Negociar" sem login: o dono do portal vê todos; a administradora, os das cotas dela.
create table if not exists public.contempladas_leads (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  lead_id uuid,
  nome text not null,
  telefone text not null,
  cota_ids uuid[] not null default '{}',
  codigos text[] not null default '{}',
  credito numeric(14,2) not null default 0,
  entrada numeric(14,2) not null default 0,
  dono_auth_ids uuid[] not null default '{}',
  dono_nomes text[] not null default '{}',
  status text not null default 'NOVO',
  created_at timestamptz not null default now()
);
create index if not exists contempladas_leads_empresa_idx on public.contempladas_leads (empresa_id, created_at desc);
alter table public.contempladas_leads enable row level security;
