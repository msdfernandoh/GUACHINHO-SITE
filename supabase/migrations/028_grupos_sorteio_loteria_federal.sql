-- Sorteio de grupos pela Loteria Federal (palavra-chave = 1º prêmio MOD quantidade de cotas)

alter table public.grupos_consorcio
  add column if not exists quantidade_cotas_sorteio integer;

comment on column public.grupos_consorcio.quantidade_cotas_sorteio is
  'Quantidade de participantes/cotas usada no sorteio mensal (inteiro > 0).';

create table if not exists public.grupos_sorteios_loteria (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos_consorcio (id) on delete cascade,
  periodo_ref date not null,
  ano integer not null,
  mes integer not null,
  primeiro_premio text not null,
  quantidade_cotas integer not null,
  palavra_chave integer not null,
  data_sorteio date,
  fonte_resultado text,
  resultado_buscado_automaticamente boolean not null default false,
  observacao text,
  criado_por_usuario_id uuid references public.usuarios (id) on delete set null,
  criado_por_nome text,
  criado_por_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grupos_sorteios_loteria_grupo_ano_mes_unique unique (grupo_id, ano, mes),
  constraint grupos_sorteios_loteria_mes_check check (mes >= 1 and mes <= 12)
);

create index if not exists grupos_sorteios_loteria_periodo_idx
  on public.grupos_sorteios_loteria (ano desc, mes desc);

create index if not exists grupos_sorteios_loteria_grupo_idx
  on public.grupos_sorteios_loteria (grupo_id, ano desc, mes desc);

alter table public.grupos_sorteios_loteria enable row level security;

create policy grupos_sorteios_loteria_public_read on public.grupos_sorteios_loteria
  for select to anon, authenticated
  using (true);

create policy grupos_sorteios_loteria_staff_write on public.grupos_sorteios_loteria
  for all to authenticated
  using (public.is_master() or public.is_staff())
  with check (public.is_master() or public.is_staff());

drop trigger if exists grupos_sorteios_loteria_updated_at on public.grupos_sorteios_loteria;
create trigger grupos_sorteios_loteria_updated_at before update on public.grupos_sorteios_loteria
  for each row execute function public.set_updated_at();
