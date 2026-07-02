-- Pacote ajustes 3 — Eventos comerciais, inscrições e agenda

alter table public.leads
  add column if not exists evento_id uuid,
  add column if not exists evento_nome text;

create index if not exists leads_evento_id_idx on public.leads (evento_id);

-- ---------------------------------------------------------------------------
-- eventos
-- ---------------------------------------------------------------------------
create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text unique not null,
  descricao_curta text,
  descricao text,
  data_evento timestamptz,
  local text,
  endereco text,
  cidade text,
  estado text,
  imagem_capa_url text,
  banner_url text,
  ativo boolean not null default true,
  publicado boolean not null default false,
  somente_por_link boolean not null default true,
  evento_destaque boolean not null default false,
  limite_participantes integer,
  permitir_acompanhante boolean not null default false,
  exigir_convidou boolean not null default false,
  mostrar_vagas boolean not null default true,
  mensagem_confirmacao text,
  observacoes_internas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists eventos_slug_idx on public.eventos (slug);
create index if not exists eventos_publicado_idx on public.eventos (publicado, ativo);
create index if not exists eventos_destaque_idx on public.eventos (evento_destaque) where evento_destaque = true;

alter table public.leads
  drop constraint if exists leads_evento_id_fkey;
alter table public.leads
  add constraint leads_evento_id_fkey foreign key (evento_id) references public.eventos (id) on delete set null;

-- ---------------------------------------------------------------------------
-- eventos_participantes
-- ---------------------------------------------------------------------------
create table if not exists public.eventos_participantes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  nome_participante text not null,
  telefone_participante text not null,
  nome_acompanhante text,
  telefone_acompanhante text,
  tem_acompanhante boolean not null default false,
  nome_convidou text,
  empresa_convidou text,
  observacao text,
  quantidade_vagas integer not null default 1,
  status text not null default 'confirmado',
  checkin_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eventos_participantes_status_check check (
    status in ('confirmado', 'cancelado', 'presente', 'ausente', 'lista_espera')
  )
);

create index if not exists eventos_participantes_evento_idx on public.eventos_participantes (evento_id);
create index if not exists eventos_participantes_status_idx on public.eventos_participantes (evento_id, status);
create index if not exists eventos_participantes_lead_idx on public.eventos_participantes (lead_id);

-- ---------------------------------------------------------------------------
-- eventos_posts (social / fotos)
-- ---------------------------------------------------------------------------
create table if not exists public.eventos_posts (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos (id) on delete cascade,
  titulo text,
  conteudo text,
  imagem_url text,
  ordem integer not null default 0,
  publicado boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists eventos_posts_evento_idx on public.eventos_posts (evento_id, ordem);

-- ---------------------------------------------------------------------------
-- agenda_compromissos
-- ---------------------------------------------------------------------------
create table if not exists public.agenda_compromissos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete set null,
  consultor_id uuid references public.usuarios (id) on delete set null,
  titulo text not null,
  descricao text,
  tipo text not null,
  data_inicio timestamptz not null,
  data_fim timestamptz,
  duracao_minutos integer,
  local text,
  status text not null default 'agendado',
  resultado text,
  observacao_resultado text,
  proxima_data timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agenda_compromissos_status_check check (
    status in ('agendado', 'concluido', 'remarcado', 'cancelado', 'nao_compareceu')
  )
);

create index if not exists agenda_compromissos_inicio_idx on public.agenda_compromissos (data_inicio);
create index if not exists agenda_compromissos_consultor_idx on public.agenda_compromissos (consultor_id, data_inicio);
create index if not exists agenda_compromissos_lead_idx on public.agenda_compromissos (lead_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.eventos enable row level security;
alter table public.eventos_participantes enable row level security;
alter table public.eventos_posts enable row level security;
alter table public.agenda_compromissos enable row level security;

drop policy if exists eventos_staff_select on public.eventos;
create policy eventos_staff_select on public.eventos for select to authenticated
  using (public.is_master() or public.is_staff());

drop policy if exists eventos_master_write on public.eventos;
create policy eventos_master_write on public.eventos for all to authenticated
  using (public.is_master())
  with check (public.is_master());

drop policy if exists eventos_public_list on public.eventos;
create policy eventos_public_list on public.eventos for select to anon
  using (
    ativo = true
    and publicado = true
    and somente_por_link = false
  );

drop policy if exists eventos_public_slug on public.eventos;
create policy eventos_public_slug on public.eventos for select to anon
  using (ativo = true and publicado = true);

drop policy if exists eventos_participantes_staff on public.eventos_participantes;
create policy eventos_participantes_staff on public.eventos_participantes for all to authenticated
  using (public.is_master() or public.is_staff())
  with check (public.is_master() or public.is_staff());

drop policy if exists eventos_posts_staff on public.eventos_posts;
create policy eventos_posts_staff on public.eventos_posts for all to authenticated
  using (public.is_master())
  with check (public.is_master());

drop policy if exists eventos_posts_public on public.eventos_posts;
create policy eventos_posts_public on public.eventos_posts for select to anon
  using (
    publicado = true
    and exists (
      select 1 from public.eventos e
      where e.id = evento_id and e.ativo = true and e.publicado = true
    )
  );

drop policy if exists agenda_staff on public.agenda_compromissos;
create policy agenda_staff on public.agenda_compromissos for all to authenticated
  using (
    public.is_master()
    or public.is_staff()
    or consultor_id = (select u.id from public.usuarios u where u.auth_user_id = auth.uid() limit 1)
  )
  with check (
    public.is_master()
    or public.is_staff()
    or consultor_id = (select u.id from public.usuarios u where u.auth_user_id = auth.uid() limit 1)
  );

-- triggers
drop trigger if exists eventos_updated_at on public.eventos;
create trigger eventos_updated_at before update on public.eventos
  for each row execute function public.set_updated_at();

drop trigger if exists eventos_participantes_updated_at on public.eventos_participantes;
create trigger eventos_participantes_updated_at before update on public.eventos_participantes
  for each row execute function public.set_updated_at();

drop trigger if exists eventos_posts_updated_at on public.eventos_posts;
create trigger eventos_posts_updated_at before update on public.eventos_posts
  for each row execute function public.set_updated_at();

drop trigger if exists agenda_compromissos_updated_at on public.agenda_compromissos;
create trigger agenda_compromissos_updated_at before update on public.agenda_compromissos
  for each row execute function public.set_updated_at();
