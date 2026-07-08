-- Listas de convidados por evento / consultor (controle de convites e resultados)

create table if not exists public.eventos_listas_convidados (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos (id) on delete cascade,
  consultor_nome text not null,
  consultor_usuario_id uuid references public.usuarios (id) on delete set null,
  criado_por_usuario_id uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists eventos_listas_convidados_evento_idx
  on public.eventos_listas_convidados (evento_id);

create index if not exists eventos_listas_convidados_consultor_idx
  on public.eventos_listas_convidados (consultor_usuario_id);

create table if not exists public.eventos_listas_convidados_itens (
  id uuid primary key default gen_random_uuid(),
  lista_id uuid not null references public.eventos_listas_convidados (id) on delete cascade,
  nome text not null,
  empresa text,
  telefone text,
  convidado_por text,
  status_presenca text not null default 'pendente',
  resultado text,
  valor numeric(14, 2),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eventos_listas_itens_status_check check (
    status_presenca in ('pendente', 'confirmado', 'cancelado', 'presente')
  ),
  constraint eventos_listas_itens_resultado_check check (
    resultado is null or resultado in ('ganho', 'sem_interesse', 'futuro')
  )
);

create index if not exists eventos_listas_itens_lista_idx
  on public.eventos_listas_convidados_itens (lista_id, ordem);

alter table public.eventos_listas_convidados enable row level security;
alter table public.eventos_listas_convidados_itens enable row level security;

create policy eventos_listas_convidados_staff on public.eventos_listas_convidados
  for all to authenticated
  using (public.is_master() or public.is_staff())
  with check (public.is_master() or public.is_staff());

create policy eventos_listas_convidados_itens_staff on public.eventos_listas_convidados_itens
  for all to authenticated
  using (public.is_master() or public.is_staff())
  with check (public.is_master() or public.is_staff());
