-- Estratégias de lance/parcela por grupo (/grupos + admin)
-- Pode rodar no Supabase mesmo se a tabela ainda não existir (substitui rodar 004 e depois 008).

create table if not exists public.grupos_modalidades_lance (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos_consorcio (id) on delete cascade,
  nome text not null,
  percentual_lance_embutido numeric(8, 4) not null default 0,
  percentual_recurso_proprio_minimo numeric(8, 4) not null default 0,
  descricao text,
  ativo boolean not null default true,
  ordem integer not null default 0,
  tipo_parcela text,
  percentual_parcela_reduzida numeric(8, 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.grupos_modalidades_lance
  add column if not exists tipo_parcela text,
  add column if not exists percentual_parcela_reduzida numeric(8, 4);

create index if not exists grupos_modalidades_lance_grupo_id_idx
  on public.grupos_modalidades_lance (grupo_id);

alter table public.grupos_consorcio
  alter column seguro_percentual type numeric(12, 6);

alter table public.simulacoes_grupos_itens
  add column if not exists modalidade_parcela text,
  add column if not exists percentual_parcela numeric(8, 4),
  add column if not exists usa_lance_embutido boolean,
  add column if not exists modalidade_lance_id uuid references public.grupos_modalidades_lance (id) on delete set null,
  add column if not exists percentual_lance_embutido numeric(8, 4),
  add column if not exists usa_recurso_proprio boolean,
  add column if not exists recurso_proprio_tipo text,
  add column if not exists recurso_proprio_valor numeric(15, 2),
  add column if not exists usa_seguro boolean,
  add column if not exists percentual_seguro numeric(12, 6),
  add column if not exists saldo_devedor_inicial numeric(15, 2),
  add column if not exists saldo_devedor_final numeric(15, 2),
  add column if not exists parcela_pos_contemplacao numeric(15, 2),
  add column if not exists credito_liquido numeric(15, 2),
  add column if not exists dados_linha jsonb;

alter table public.grupos_modalidades_lance enable row level security;

drop policy if exists "grupos_modalidades_lance_select_public" on public.grupos_modalidades_lance;
create policy "grupos_modalidades_lance_select_public"
  on public.grupos_modalidades_lance for select
  using (true);

drop policy if exists "grupos_modalidades_lance_staff_all" on public.grupos_modalidades_lance;
create policy "grupos_modalidades_lance_staff_all"
  on public.grupos_modalidades_lance for all
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid()
        and u.perfil in ('Master', 'Admin', 'SRD')
    )
  );

comment on column public.grupos_modalidades_lance.tipo_parcela is
  'integral | reduzida — quando preenchido, fixa o tipo de parcela ao escolher a estratégia.';
comment on column public.grupos_modalidades_lance.percentual_parcela_reduzida is
  'Referência % da parcela reduzida (informativo / legado; cálculo usa cotas).';

-- Parcelas automáticas (007) — incluído aqui para um único run no painel
alter table public.grupos_consorcio
  add column if not exists parcelas_realizadas_base integer,
  add column if not exists data_base_parcelas date,
  add column if not exists atualizacao_parcelas_automatica boolean not null default false;
