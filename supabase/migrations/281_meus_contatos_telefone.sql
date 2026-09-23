-- Fase 286: contatos telefônicos privados por usuário e empresa.
create table if not exists public.contatos_usuario (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  nome text not null,
  telefone text not null,
  telefone_normalizado text not null,
  email text,
  empresa text,
  profissao text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, usuario_id, telefone_normalizado)
);
create index if not exists contatos_usuario_scope_idx on public.contatos_usuario(empresa_id, usuario_id, nome);
alter table public.contatos_usuario enable row level security;
drop policy if exists contatos_usuario_select_own on public.contatos_usuario;
create policy contatos_usuario_select_own on public.contatos_usuario for select to authenticated
using (usuario_id = public.current_usuario_id() and exists (select 1 from public.empresa_usuarios eu where eu.empresa_id = contatos_usuario.empresa_id and eu.usuario_id = public.current_usuario_id() and eu.ativo));
drop policy if exists contatos_usuario_insert_own on public.contatos_usuario;
create policy contatos_usuario_insert_own on public.contatos_usuario for insert to authenticated
with check (usuario_id = public.current_usuario_id() and exists (select 1 from public.empresa_usuarios eu where eu.empresa_id = contatos_usuario.empresa_id and eu.usuario_id = public.current_usuario_id() and eu.ativo));
drop policy if exists contatos_usuario_update_own on public.contatos_usuario;
create policy contatos_usuario_update_own on public.contatos_usuario for update to authenticated
using (usuario_id = public.current_usuario_id() and exists (select 1 from public.empresa_usuarios eu where eu.empresa_id = contatos_usuario.empresa_id and eu.usuario_id = public.current_usuario_id() and eu.ativo))
with check (usuario_id = public.current_usuario_id() and exists (select 1 from public.empresa_usuarios eu where eu.empresa_id = contatos_usuario.empresa_id and eu.usuario_id = public.current_usuario_id() and eu.ativo));
drop policy if exists contatos_usuario_delete_own on public.contatos_usuario;
create policy contatos_usuario_delete_own on public.contatos_usuario for delete to authenticated
using (usuario_id = public.current_usuario_id() and exists (select 1 from public.empresa_usuarios eu where eu.empresa_id = contatos_usuario.empresa_id and eu.usuario_id = public.current_usuario_id() and eu.ativo));
