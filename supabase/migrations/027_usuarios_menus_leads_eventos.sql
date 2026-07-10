-- Menus admin, escopo de leads por usuário e acesso a leads de eventos

alter table public.usuarios
  add column if not exists admin_menus jsonb,
  add column if not exists leads_apenas_proprios boolean not null default false;

comment on column public.usuarios.admin_menus is 'Chaves de menu admin permitidas; null = padrão do perfil.';
comment on column public.usuarios.leads_apenas_proprios is 'Se true, usuário vê só leads em que é consultor responsável.';

alter table public.eventos
  add column if not exists leads_acesso_todos boolean not null default true;

comment on column public.eventos.leads_acesso_todos is 'Se true, qualquer usuário com menu Leads vê leads deste evento; se false, só usuários marcados.';

create table if not exists public.eventos_leads_usuarios (
  evento_id uuid not null references public.eventos (id) on delete cascade,
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (evento_id, usuario_id)
);

create index if not exists eventos_leads_usuarios_usuario_idx
  on public.eventos_leads_usuarios (usuario_id);

alter table public.eventos_leads_usuarios enable row level security;

drop policy if exists eventos_leads_usuarios_staff on public.eventos_leads_usuarios;
create policy eventos_leads_usuarios_staff on public.eventos_leads_usuarios
  for all to authenticated
  using (public.is_master() or public.is_staff())
  with check (public.is_master() or public.is_staff());
