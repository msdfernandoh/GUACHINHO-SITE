-- Convites do app do indicador aguardando a publicação da próxima edição.
create table if not exists public.programa_convites_eventos_pendentes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete restrict,
  indicador_id uuid not null references public.programa_indicadores(id) on delete restrict,
  lead_id uuid not null references public.leads(id) on delete restrict,
  nome text not null,
  telefone text not null,
  empresa_atividade text,
  observacao text,
  status text not null default 'PENDENTE' check (status in ('PENDENTE','VINCULADO')),
  evento_id uuid references public.eventos(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, lead_id)
);

create index if not exists programa_convites_eventos_pendentes_fila_idx
  on public.programa_convites_eventos_pendentes(empresa_id, status, created_at desc);

alter table public.programa_convites_eventos_pendentes enable row level security;
create policy programa_convites_eventos_pendentes_select
  on public.programa_convites_eventos_pendentes for select to authenticated
  using (public.can_read_tenant_internal(empresa_id));
create policy programa_convites_eventos_pendentes_write
  on public.programa_convites_eventos_pendentes for all to authenticated
  using (public.can_write_tenant_internal(empresa_id))
  with check (public.can_write_tenant_internal(empresa_id));
revoke all on public.programa_convites_eventos_pendentes from public, anon;
grant select, insert, update, delete on public.programa_convites_eventos_pendentes to authenticated, service_role;

notify pgrst, 'reload schema';
