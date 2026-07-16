-- Cadastro em fases (NPS + indicações), cupons extras e QR Codes únicos reutilizáveis

-- ---------------------------------------------------------------------------
-- Participantes: fases, origem do cupom e NPS
-- ---------------------------------------------------------------------------
alter table public.eventos_sorteio_participantes
  add column if not exists fase_cadastro text not null default 'completo',
  add column if not exists origem_cupom text not null default 'cadastro',
  add column if not exists participante_principal_id uuid references public.eventos_sorteio_participantes (id) on delete set null,
  add column if not exists nps_respostas jsonb,
  add column if not exists nps_completo_em timestamptz,
  add column if not exists indicacoes_concluido_em timestamptz,
  add column if not exists qr_code_unico_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'eventos_sorteio_participantes_fase_check'
  ) then
    alter table public.eventos_sorteio_participantes
      add constraint eventos_sorteio_participantes_fase_check
      check (fase_cadastro in ('fase1', 'fase2', 'fase3', 'completo'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'eventos_sorteio_participantes_origem_cupom_check'
  ) then
    alter table public.eventos_sorteio_participantes
      add constraint eventos_sorteio_participantes_origem_cupom_check
      check (origem_cupom in ('cadastro', 'indicacao'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Config NPS por sorteio (fixas on/off + perguntas custom)
-- ---------------------------------------------------------------------------
alter table public.eventos_sorteios
  add column if not exists nps_config jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Indicações (fase 3)
-- ---------------------------------------------------------------------------
create table if not exists public.eventos_sorteio_indicacoes (
  id uuid primary key default gen_random_uuid(),
  sorteio_id uuid not null references public.eventos_sorteios (id) on delete cascade,
  evento_id uuid not null references public.eventos (id) on delete cascade,
  indicador_participante_id uuid not null references public.eventos_sorteio_participantes (id) on delete cascade,
  nome text not null,
  tipo text not null,
  telefone text not null,
  cupom_gerado boolean not null default false,
  participante_cupom_id uuid references public.eventos_sorteio_participantes (id) on delete set null,
  aviso text,
  created_at timestamptz not null default now(),
  constraint eventos_sorteio_indicacoes_tipo_check check (tipo in ('amigo', 'familiar'))
);

create index if not exists eventos_sorteio_indicacoes_indicador_idx
  on public.eventos_sorteio_indicacoes (indicador_participante_id);

create index if not exists eventos_sorteio_indicacoes_sorteio_idx
  on public.eventos_sorteio_indicacoes (sorteio_id);

alter table public.eventos_sorteio_indicacoes enable row level security;

drop policy if exists eventos_sorteio_indicacoes_staff on public.eventos_sorteio_indicacoes;
create policy eventos_sorteio_indicacoes_staff on public.eventos_sorteio_indicacoes
  for all to authenticated
  using (public.is_master() or public.is_staff())
  with check (public.is_master() or public.is_staff());

-- ---------------------------------------------------------------------------
-- QR Codes únicos (materiais impressos reutilizáveis)
-- ---------------------------------------------------------------------------
create table if not exists public.qr_codes_unicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qr_codes_unicos_slug_unique unique (slug)
);

create table if not exists public.qr_codes_unicos_vinculos (
  id uuid primary key default gen_random_uuid(),
  qr_code_id uuid not null references public.qr_codes_unicos (id) on delete cascade,
  evento_id uuid not null references public.eventos (id) on delete cascade,
  periodo_inicio timestamptz not null,
  periodo_fim timestamptz not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qr_codes_unicos_vinculos_periodo_check check (periodo_fim > periodo_inicio)
);

-- Enquanto ativo em um evento, não pode estar ativo em outro
create unique index if not exists qr_codes_unicos_vinculos_um_ativo_por_qr
  on public.qr_codes_unicos_vinculos (qr_code_id)
  where ativo = true;

create index if not exists qr_codes_unicos_vinculos_evento_idx
  on public.qr_codes_unicos_vinculos (evento_id, ativo);

create index if not exists qr_codes_unicos_vinculos_periodo_idx
  on public.qr_codes_unicos_vinculos (qr_code_id, periodo_inicio, periodo_fim)
  where ativo = true;

alter table public.qr_codes_unicos enable row level security;
alter table public.qr_codes_unicos_vinculos enable row level security;

drop policy if exists qr_codes_unicos_staff on public.qr_codes_unicos;
create policy qr_codes_unicos_staff on public.qr_codes_unicos
  for all to authenticated
  using (public.is_master() or public.is_staff())
  with check (public.is_master() or public.is_staff());

drop policy if exists qr_codes_unicos_vinculos_staff on public.qr_codes_unicos_vinculos;
create policy qr_codes_unicos_vinculos_staff on public.qr_codes_unicos_vinculos
  for all to authenticated
  using (public.is_master() or public.is_staff())
  with check (public.is_master() or public.is_staff());

drop trigger if exists qr_codes_unicos_updated_at on public.qr_codes_unicos;
create trigger qr_codes_unicos_updated_at before update on public.qr_codes_unicos
  for each row execute function public.set_updated_at();

drop trigger if exists qr_codes_unicos_vinculos_updated_at on public.qr_codes_unicos_vinculos;
create trigger qr_codes_unicos_vinculos_updated_at before update on public.qr_codes_unicos_vinculos
  for each row execute function public.set_updated_at();

-- FK opcional do participante para o QR de origem
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'eventos_sorteio_participantes_qr_fk'
  ) then
    alter table public.eventos_sorteio_participantes
      add constraint eventos_sorteio_participantes_qr_fk
      foreign key (qr_code_unico_id) references public.qr_codes_unicos (id) on delete set null;
  end if;
end $$;
