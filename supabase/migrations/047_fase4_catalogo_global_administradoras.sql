-- ============================================================================
-- Migration 047: Catálogo Global de Administradoras (Fase 4 — E1 fundação)
--
-- NÃO APLICAR sem autorização explícita do proprietário.
--
-- Escopo:
--   - public.administradoras (catálogo global)
--   - public.empresa_administradoras (concessão Superadmin)
--   - grupos_consorcio.administradora_id uuid NULL (sem backfill)
--   - seed idempotente: Racon + vínculo Gauchinho ATIVA
--   - RLS restritiva (somente PLATFORM_SUPERADMIN)
--   - permissões somente para super_admin
--
-- Explicitamente NÃO faz:
--   - backfill dos 19 grupos / alteração do texto administradora
--   - alteração de RLS/policies de grupos/cotas/modalidades
--   - alteração de APIs / simulador / propostas / contratações / cartas
--   - vínculo Empresa B
--   - secrets/credenciais de integração
--   - triggers em audit_logs (usar audit_logs existente via app em E2/E3)
--
-- Seed IDs estáveis:
--   Racon  = c5f8ecb4-cb5a-5014-b567-50484719b404  (uuidv5 DNS + saas.gauchinho.administradora.racon)
--   Gauchinho localizado por slug único 'gauchinho' (prod: 7170f38e-15dd-4b19-8588-51e9a9cf0d4c)
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- 0. Dependências
-- --------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    raise exception 'Função public.set_updated_at() não encontrada. Execute migrations anteriores.';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_platform_superadmin'
  ) then
    raise exception 'Função public.is_platform_superadmin() não encontrada. Execute a migration 043.';
  end if;

  if not exists (select 1 from public.empresas where slug = 'gauchinho') then
    raise exception 'Empresa slug=gauchinho não encontrada. Abortando seed seguro.';
  end if;

  if (select count(*) from public.empresas where slug = 'gauchinho') <> 1 then
    raise exception 'slug=gauchinho não é único. Abortando para evitar vínculo errado.';
  end if;

  if not exists (
    select 1 from public.papeis where codigo = 'super_admin' and empresa_id is null
  ) then
    raise exception 'Papel super_admin global não encontrado.';
  end if;
end $$;

-- --------------------------------------------------------------------------
-- 1. Normalizador de slug de administradora
-- --------------------------------------------------------------------------
create or replace function public.normalize_administradora_slug(p_valor text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    regexp_replace(
      lower(trim(coalesce(p_valor, ''))),
      '[^a-z0-9]+',
      '-',
      'g'
    ),
    ''
  );
$$;

revoke all on function public.normalize_administradora_slug(text) from public;
grant execute on function public.normalize_administradora_slug(text) to authenticated, service_role;

create or replace function public.normalize_cnpj_digits(p_valor text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(regexp_replace(coalesce(p_valor, ''), '[^0-9]', '', 'g'), '');
$$;

revoke all on function public.normalize_cnpj_digits(text) from public;
grant execute on function public.normalize_cnpj_digits(text) to authenticated, service_role;

-- --------------------------------------------------------------------------
-- 2. Tabela global administradoras
-- --------------------------------------------------------------------------
create table if not exists public.administradoras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nome_fantasia text,
  razao_social text,
  cnpj text,
  slug text not null,
  logo_url text,
  site_url text,
  status text not null default 'ATIVA'
    check (status in ('ATIVA', 'INATIVA')),
  recursos_integracao jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_usuario_id uuid references public.usuarios (id) on delete set null,
  updated_by_usuario_id uuid references public.usuarios (id) on delete set null,
  constraint administradoras_nome_nao_vazio check (length(trim(nome)) > 0),
  constraint administradoras_slug_nao_vazio check (length(trim(slug)) > 0)
);

comment on table public.administradoras is
  'Catálogo GLOBAL de administradoras da plataforma SaaS. Concessão a tenants ocorre em empresa_administradoras (somente Superadmin).';
comment on column public.administradoras.status is
  'ATIVA | INATIVA — soft status; sem delete físico operacional.';

create unique index if not exists administradoras_slug_uidx
  on public.administradoras (slug);

-- CNPJ único apenas quando preenchido (normalizado em trigger)
create unique index if not exists administradoras_cnpj_uidx
  on public.administradoras (cnpj)
  where cnpj is not null and cnpj <> '';

create index if not exists administradoras_status_idx
  on public.administradoras (status);

drop trigger if exists administradoras_updated_at on public.administradoras;
create trigger administradoras_updated_at
  before update on public.administradoras
  for each row execute function public.set_updated_at();

create or replace function public.administradoras_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.nome := trim(new.nome);
  new.nome_fantasia := nullif(trim(coalesce(new.nome_fantasia, '')), '');
  new.razao_social := nullif(trim(coalesce(new.razao_social, '')), '');
  new.slug := public.normalize_administradora_slug(new.slug);
  if new.slug is null then
    raise exception 'slug de administradora inválido/vazio';
  end if;
  new.cnpj := public.normalize_cnpj_digits(new.cnpj);
  new.logo_url := nullif(trim(coalesce(new.logo_url, '')), '');
  new.site_url := nullif(trim(coalesce(new.site_url, '')), '');
  new.status := upper(trim(new.status));
  if new.recursos_integracao is null then
    new.recursos_integracao := '{}'::jsonb;
  end if;
  if new.metadata is null then
    new.metadata := '{}'::jsonb;
  end if;
  return new;
end;
$$;

revoke all on function public.administradoras_before_write() from public;

drop trigger if exists administradoras_normalize on public.administradoras;
create trigger administradoras_normalize
  before insert or update on public.administradoras
  for each row execute function public.administradoras_before_write();

-- --------------------------------------------------------------------------
-- 3. Tabela empresa_administradoras (concessão plataforma)
-- --------------------------------------------------------------------------
create table if not exists public.empresa_administradoras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  administradora_id uuid not null references public.administradoras (id) on delete restrict,
  status text not null default 'ATIVA'
    check (status in ('ATIVA', 'INATIVA', 'SUSPENSA')),
  codigo_franquia text,
  codigo_comercial text,
  contato_interno text,
  observacoes text,
  configuracoes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_usuario_id uuid references public.usuarios (id) on delete set null,
  updated_by_usuario_id uuid references public.usuarios (id) on delete set null,
  constraint empresa_administradoras_empresa_admin_uidx unique (empresa_id, administradora_id)
);

comment on table public.empresa_administradoras is
  'Concessão PLATFORM_SUPERADMIN: empresa × administradora. NÃO é preferência do tenant.';
comment on column public.empresa_administradoras.status is
  'ATIVA | INATIVA | SUSPENSA — soft status; histórico preservado.';
comment on column public.empresa_administradoras.configuracoes is
  'JSON de parâmetros locais (sem secrets nesta fase). Credenciais futuras: storage seguro.';

create index if not exists empresa_administradoras_empresa_idx
  on public.empresa_administradoras (empresa_id);

create index if not exists empresa_administradoras_admin_idx
  on public.empresa_administradoras (administradora_id);

create index if not exists empresa_administradoras_status_idx
  on public.empresa_administradoras (empresa_id, status);

drop trigger if exists empresa_administradoras_updated_at on public.empresa_administradoras;
create trigger empresa_administradoras_updated_at
  before update on public.empresa_administradoras
  for each row execute function public.set_updated_at();

create or replace function public.empresa_administradoras_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.status := upper(trim(new.status));
  new.codigo_franquia := nullif(trim(coalesce(new.codigo_franquia, '')), '');
  new.codigo_comercial := nullif(trim(coalesce(new.codigo_comercial, '')), '');
  new.contato_interno := nullif(trim(coalesce(new.contato_interno, '')), '');
  new.observacoes := nullif(trim(coalesce(new.observacoes, '')), '');
  if new.configuracoes is null then
    new.configuracoes := '{}'::jsonb;
  end if;
  return new;
end;
$$;

revoke all on function public.empresa_administradoras_before_write() from public;

drop trigger if exists empresa_administradoras_normalize on public.empresa_administradoras;
create trigger empresa_administradoras_normalize
  before insert or update on public.empresa_administradoras
  for each row execute function public.empresa_administradoras_before_write();

-- --------------------------------------------------------------------------
-- 4. grupos_consorcio.administradora_id (ADITIVO, nullable, SEM backfill)
-- --------------------------------------------------------------------------
alter table public.grupos_consorcio
  add column if not exists administradora_id uuid
    references public.administradoras (id) on delete restrict;

comment on column public.grupos_consorcio.administradora_id is
  'FK futura para catálogo global. Nullable na E1; texto administradora permanece intacto (sem backfill).';

create index if not exists grupos_consorcio_administradora_id_idx
  on public.grupos_consorcio (administradora_id);

-- --------------------------------------------------------------------------
-- 5. Seed Racon (UUID determinístico v5) + vínculo Gauchinho
-- UUID v5(DNS, 'saas.gauchinho.administradora.racon') =
--   c5f8ecb4-cb5a-5014-b567-50484719b404
-- --------------------------------------------------------------------------
insert into public.administradoras (
  id,
  nome,
  nome_fantasia,
  slug,
  status,
  recursos_integracao,
  metadata
)
values (
  'c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid,
  'Racon',
  'Racon',
  'racon',
  'ATIVA',
  '{}'::jsonb,
  jsonb_build_object(
    'seed', 'fase4_e1',
    'uuid_source', 'uuidv5(DNS, saas.gauchinho.administradora.racon)',
    'legacy_text_aliases', jsonb_build_array('RACON', 'Racon')
  )
)
on conflict (id) do update set
  nome = excluded.nome,
  nome_fantasia = coalesce(public.administradoras.nome_fantasia, excluded.nome_fantasia),
  slug = excluded.slug,
  status = coalesce(public.administradoras.status, excluded.status),
  updated_at = now();

-- Garante unicidade lógica do slug racon mesmo se ID divergir em ambiente estranho
do $$
declare
  v_cnt int;
begin
  select count(*) into v_cnt from public.administradoras where slug = 'racon';
  if v_cnt <> 1 then
    raise exception 'Esperado exatamente 1 administradora slug=racon; encontrado %', v_cnt;
  end if;
end $$;

insert into public.empresa_administradoras (
  empresa_id,
  administradora_id,
  status,
  observacoes,
  configuracoes
)
select
  e.id,
  'c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid,
  'ATIVA',
  'Concessão seed Fase 4 E1 — Gauchinho × Racon',
  '{}'::jsonb
from public.empresas e
where e.slug = 'gauchinho'
on conflict (empresa_id, administradora_id) do update set
  status = 'ATIVA',
  updated_at = now();

-- Empresa B: zero concessões (asserção)
do $$
declare
  v_emp_b uuid;
  v_cnt int;
  v_g_cnt int;
  v_null_admin_id int;
begin
  select id into v_emp_b from public.empresas where slug = 'empresa-b';
  if v_emp_b is not null then
    select count(*) into v_cnt
    from public.empresa_administradoras
    where empresa_id = v_emp_b;
    if v_cnt <> 0 then
      raise exception 'Empresa B não deve receber concessão na 047; encontrado %', v_cnt;
    end if;
  end if;

  -- Nenhum backfill em grupos
  select count(*) into v_null_admin_id
  from public.grupos_consorcio
  where administradora_id is not null;
  if v_null_admin_id <> 0 then
    raise exception 'Backfill proibido na E1: % grupos com administradora_id preenchido', v_null_admin_id;
  end if;

  select count(*) into v_g_cnt from public.grupos_consorcio;
  if v_g_cnt < 1 then
    raise notice 'Ambiente sem grupos — ok para dry-run/vazio';
  end if;
end $$;

-- --------------------------------------------------------------------------
-- 6. Permissões (somente super_admin)
-- --------------------------------------------------------------------------
insert into public.permissoes (codigo, nome, modulo, descricao)
values
  (
    'gerenciar_catalogo_administradoras',
    'Gerenciar Catálogo Global de Administradoras',
    'saas',
    'CRUD do catálogo global de administradoras (somente PLATFORM_SUPERADMIN)'
  ),
  (
    'gerenciar_administradoras_empresa',
    'Gerenciar Concessões Administradora × Empresa',
    'saas',
    'Conceder/suspender/reativar administradoras para empresas (somente PLATFORM_SUPERADMIN)'
  )
on conflict (codigo) do update set
  nome = excluded.nome,
  modulo = excluded.modulo,
  descricao = excluded.descricao;

do $$
declare
  v_role_super uuid;
  v_role_admin uuid;
  v_role_parceiro uuid;
  v_perm record;
begin
  select id into v_role_super from public.papeis where codigo = 'super_admin' and empresa_id is null;
  select id into v_role_admin from public.papeis where codigo = 'admin_empresa' and empresa_id is null;
  select id into v_role_parceiro from public.papeis where codigo = 'parceiro_comercial' and empresa_id is null;

  if v_role_super is null then
    raise exception 'Papel super_admin ausente';
  end if;

  for v_perm in
    select id, codigo from public.permissoes
    where codigo in (
      'gerenciar_catalogo_administradoras',
      'gerenciar_administradoras_empresa'
    )
  loop
    insert into public.papel_permissoes (papel_id, permissao_id)
    values (v_role_super, v_perm.id)
    on conflict do nothing;

    -- Garantia: admin_empresa e parceiro NÃO recebem
    if v_role_admin is not null then
      delete from public.papel_permissoes
      where papel_id = v_role_admin and permissao_id = v_perm.id;
    end if;
    if v_role_parceiro is not null then
      delete from public.papel_permissoes
      where papel_id = v_role_parceiro and permissao_id = v_perm.id;
    end if;
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- 7. RLS — administradoras (somente Superadmin)
-- --------------------------------------------------------------------------
alter table public.administradoras enable row level security;
alter table public.administradoras force row level security;

drop policy if exists administradoras_superadmin_select on public.administradoras;
create policy administradoras_superadmin_select
  on public.administradoras
  for select
  to authenticated
  using (public.is_platform_superadmin());

drop policy if exists administradoras_superadmin_insert on public.administradoras;
create policy administradoras_superadmin_insert
  on public.administradoras
  for insert
  to authenticated
  with check (public.is_platform_superadmin());

drop policy if exists administradoras_superadmin_update on public.administradoras;
create policy administradoras_superadmin_update
  on public.administradoras
  for update
  to authenticated
  using (public.is_platform_superadmin())
  with check (public.is_platform_superadmin());

-- Sem DELETE policy: remoção física não é fluxo operacional (usar status INATIVA).

revoke all on table public.administradoras from anon;
revoke all on table public.administradoras from authenticated;
grant select, insert, update on table public.administradoras to authenticated;
grant all on table public.administradoras to service_role;

-- --------------------------------------------------------------------------
-- 8. RLS — empresa_administradoras
-- Decisão E1 (mais segura): SELECT/escrita somente Superadmin.
-- Tenant NÃO lê a tabela diretamente até helpers E2/E6.
-- --------------------------------------------------------------------------
alter table public.empresa_administradoras enable row level security;
alter table public.empresa_administradoras force row level security;

drop policy if exists empresa_administradoras_superadmin_select on public.empresa_administradoras;
create policy empresa_administradoras_superadmin_select
  on public.empresa_administradoras
  for select
  to authenticated
  using (public.is_platform_superadmin());

drop policy if exists empresa_administradoras_superadmin_insert on public.empresa_administradoras;
create policy empresa_administradoras_superadmin_insert
  on public.empresa_administradoras
  for insert
  to authenticated
  with check (public.is_platform_superadmin());

drop policy if exists empresa_administradoras_superadmin_update on public.empresa_administradoras;
create policy empresa_administradoras_superadmin_update
  on public.empresa_administradoras
  for update
  to authenticated
  using (public.is_platform_superadmin())
  with check (public.is_platform_superadmin());

revoke all on table public.empresa_administradoras from anon;
revoke all on table public.empresa_administradoras from authenticated;
grant select, insert, update on table public.empresa_administradoras to authenticated;
grant all on table public.empresa_administradoras to service_role;

-- --------------------------------------------------------------------------
-- 9. Asserções finais (seed / não-backfill)
-- --------------------------------------------------------------------------
do $$
declare
  v_racon uuid := 'c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid;
  v_gauchinho uuid;
  v_link int;
  v_b int;
  v_filled int;
  v_text_intact int;
begin
  select id into v_gauchinho from public.empresas where slug = 'gauchinho';
  if v_gauchinho is null then
    raise exception 'Gauchinho não encontrado após seed';
  end if;

  if not exists (
    select 1 from public.administradoras
    where id = v_racon and slug = 'racon' and status = 'ATIVA'
  ) then
    raise exception 'Seed Racon falhou';
  end if;

  select count(*) into v_link
  from public.empresa_administradoras
  where empresa_id = v_gauchinho
    and administradora_id = v_racon
    and status = 'ATIVA';
  if v_link <> 1 then
    raise exception 'Vínculo Gauchinho×Racon ATIVA esperado=1; obtido=%', v_link;
  end if;

  select count(*) into v_b
  from public.empresa_administradoras ea
  join public.empresas e on e.id = ea.empresa_id
  where e.slug = 'empresa-b';
  if v_b <> 0 then
    raise exception 'Empresa B não deve ter concessões; obtido=%', v_b;
  end if;

  select count(*) into v_filled
  from public.grupos_consorcio
  where administradora_id is not null;
  if v_filled <> 0 then
    raise exception 'E1 proíbe backfill: % grupos com administradora_id', v_filled;
  end if;

  -- Texto legado ainda presente (quando há grupos)
  select count(*) into v_text_intact
  from public.grupos_consorcio
  where administradora is not null;
  -- Sem assert numérico fixo (ambientes vazios); apenas notice
  raise notice '047 OK: Racon=% Gauchinho=% grupos_com_texto_admin=%', v_racon, v_gauchinho, v_text_intact;
end $$;

commit;
