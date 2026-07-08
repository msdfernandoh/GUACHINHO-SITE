-- Sorteio de brindes vinculado a eventos (captura de leads + QR Code)

create table if not exists public.eventos_sorteios (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos (id) on delete cascade,
  ativo boolean not null default false,
  titulo text,
  descricao text,
  texto_agradecimento text,
  quantidade_brindes integer not null default 1,
  mostrar_home boolean not null default false,
  permitir_telefone_duplicado boolean not null default false,
  status text not null default 'aberto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eventos_sorteios_status_check check (status in ('aberto', 'encerrado')),
  constraint eventos_sorteios_evento_unique unique (evento_id)
);

create index if not exists eventos_sorteios_home_idx
  on public.eventos_sorteios (mostrar_home, ativo, status)
  where mostrar_home = true and ativo = true;

create table if not exists public.eventos_sorteio_participantes (
  id uuid primary key default gen_random_uuid(),
  sorteio_id uuid not null references public.eventos_sorteios (id) on delete cascade,
  evento_id uuid not null references public.eventos (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  codigo text not null,
  nome text not null,
  telefone text not null,
  valor_mensal_disponivel numeric(14, 2),
  tipo_sonho text,
  quem_convidou text,
  observacao text,
  status text not null default 'participando',
  ganhador boolean not null default false,
  sorteado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eventos_sorteio_participantes_status_check check (
    status in ('participando', 'cancelado')
  ),
  constraint eventos_sorteio_participantes_evento_codigo_unique unique (evento_id, codigo)
);

create index if not exists eventos_sorteio_participantes_sorteio_idx
  on public.eventos_sorteio_participantes (sorteio_id, status, ganhador);

create index if not exists eventos_sorteio_participantes_telefone_idx
  on public.eventos_sorteio_participantes (sorteio_id, telefone);

create table if not exists public.eventos_sorteio_resultados (
  id uuid primary key default gen_random_uuid(),
  sorteio_id uuid not null references public.eventos_sorteios (id) on delete cascade,
  evento_id uuid not null references public.eventos (id) on delete cascade,
  participante_id uuid not null references public.eventos_sorteio_participantes (id) on delete cascade,
  codigo text not null,
  nome text not null,
  ordem integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists eventos_sorteio_resultados_sorteio_idx
  on public.eventos_sorteio_resultados (sorteio_id, ordem);

alter table public.eventos_sorteios enable row level security;
alter table public.eventos_sorteio_participantes enable row level security;
alter table public.eventos_sorteio_resultados enable row level security;

create policy eventos_sorteios_staff on public.eventos_sorteios
  for all to authenticated
  using (public.is_master() or public.is_staff())
  with check (public.is_master() or public.is_staff());

create policy eventos_sorteio_participantes_staff on public.eventos_sorteio_participantes
  for all to authenticated
  using (public.is_master() or public.is_staff())
  with check (public.is_master() or public.is_staff());

create policy eventos_sorteio_resultados_staff on public.eventos_sorteio_resultados
  for all to authenticated
  using (public.is_master() or public.is_staff())
  with check (public.is_master() or public.is_staff());

drop trigger if exists eventos_sorteios_updated_at on public.eventos_sorteios;
create trigger eventos_sorteios_updated_at before update on public.eventos_sorteios
  for each row execute function public.set_updated_at();

drop trigger if exists eventos_sorteio_participantes_updated_at on public.eventos_sorteio_participantes;
create trigger eventos_sorteio_participantes_updated_at before update on public.eventos_sorteio_participantes
  for each row execute function public.set_updated_at();
