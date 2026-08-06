-- ============================================================================
-- Migration 044: Sites Multiempresa — Domínios e Branding (Fase 2)
-- Escopo restrito: cadastro de domínios/subdomínios por empresa, branding por
-- empresa, e a Empresa B como segundo tenant de demonstração (sem CNPJ real,
-- sem domínio real, sem usuários, sem leads/propostas/grupos/contratações).
-- Nenhuma tabela legada (usuarios, leads, propostas, grupos_consorcio,
-- grupos_cotas, contratacoes_online, agenda, etc.) é alterada por esta migration.
-- Segue o padrão de segurança da 043: privilégios e RLS concedidos
-- estritamente às tabelas novas, anon sem nenhum acesso.
-- ============================================================================

begin;

-- 0. Validação de dependência prévia
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    raise exception 'Função public.set_updated_at() não encontrada. Execute as migrations 001 a 043 antes da 044.';
  end if;

  if not exists (select 1 from public.empresas where slug = 'gauchinho') then
    raise exception 'Empresa "gauchinho" não encontrada em public.empresas. Execute a migration 043 antes da 044.';
  end if;
end $$;

-- ============================================================================
-- 0.1 Função de normalização de domínio (espelha a regra do código)
-- ============================================================================
create or replace function public.normalize_empresa_dominio_valor(p_valor text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
begin
  if p_valor is null then
    return null;
  end if;
  v := lower(trim(p_valor));
  v := regexp_replace(v, '^[a-z][a-z0-9+.-]*://', '');
  if position('@' in v) > 0 then
    v := substring(v from position('@' in v) + 1);
  end if;
  v := split_part(v, '/', 1);
  v := split_part(v, '?', 1);
  v := split_part(v, '#', 1);
  if position(':' in v) > 0 and left(v, 1) <> '[' then
    v := split_part(v, ':', 1);
  end if;
  v := trim(both from v);
  if left(v, 4) = 'www.' then
    v := substring(v from 5);
  end if;
  return v;
end;
$$;

revoke all on function public.normalize_empresa_dominio_valor(text) from public;
grant execute on function public.normalize_empresa_dominio_valor(text) to authenticated, service_role;

create or replace function public.empresa_dominios_before_write()
returns trigger
language plpgsql
as $$
declare
  v text;
begin
  v := public.normalize_empresa_dominio_valor(new.valor);
  if v is null or v = '' then
    raise exception 'empresa_dominios.valor inválido (vazio após normalização)';
  end if;
  if char_length(v) > 253 then
    raise exception 'empresa_dominios.valor excede 253 caracteres';
  end if;
  if v in ('localhost', '127.0.0.1', '0.0.0.0', '::1') or v like '%.localhost' then
    raise exception 'empresa_dominios.valor não pode ser localhost';
  end if;
  if v ~ '^[0-9]{1,3}(\.[0-9]{1,3}){3}$' then
    raise exception 'empresa_dominios.valor não pode ser IP';
  end if;
  if position('*' in v) > 0 or position(' ' in v) > 0 then
    raise exception 'empresa_dominios.valor contém caracteres inválidos';
  end if;
  if v !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' then
    raise exception 'empresa_dominios.valor com formato inválido';
  end if;
  new.valor := v;
  return new;
end;
$$;

-- ============================================================================
-- 1. Tabela de Domínios/Subdomínios por Empresa
-- ============================================================================
create table if not exists public.empresa_dominios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  tipo text not null check (tipo in ('DOMINIO_CUSTOMIZADO', 'SUBDOMINIO')),
  valor text not null,
  principal boolean not null default false,
  ativo boolean not null default true,
  verificado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint empresa_dominios_valor_normalizado check (
    valor = lower(valor)
    and valor not like 'www.%'
    and valor !~ ':'
    and valor !~ '/'
    and valor !~ '\*'
    and valor <> ''
    and char_length(valor) <= 253
  )
);

-- Unicidade do host ativo após normalização (valor já normalizado no trigger)
create unique index if not exists empresa_dominios_valor_ativo_idx
  on public.empresa_dominios (valor) where ativo = true;

create unique index if not exists empresa_dominios_principal_unico_idx
  on public.empresa_dominios (empresa_id) where principal = true and ativo = true;

create index if not exists empresa_dominios_empresa_idx on public.empresa_dominios (empresa_id);

drop trigger if exists empresa_dominios_normalize on public.empresa_dominios;
create trigger empresa_dominios_normalize
  before insert or update of valor on public.empresa_dominios
  for each row execute function public.empresa_dominios_before_write();

drop trigger if exists empresa_dominios_updated_at on public.empresa_dominios;
create trigger empresa_dominios_updated_at before update on public.empresa_dominios
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 2. Tabela de Branding por Empresa (1:1)
-- ============================================================================
create table if not exists public.empresa_branding (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null unique references public.empresas (id) on delete cascade,
  nome_site text not null,
  subtitulo text not null default '',
  descricao_institucional text not null default '',
  logo_url text,
  logo_claro_url text,
  logo_escuro_url text,
  favicon_url text,
  cor_primaria text,
  cor_secundaria text,
  cor_destaque text,
  telefone text not null default '',
  whatsapp text not null default '',
  email_contato text not null default '',
  redes_sociais jsonb not null default '{}'::jsonb,
  seo_titulo text,
  seo_descricao text,
  status_publicacao text not null default 'RASCUNHO' check (status_publicacao in ('RASCUNHO', 'PUBLICADO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists empresa_branding_updated_at on public.empresa_branding;
create trigger empresa_branding_updated_at before update on public.empresa_branding
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 3. Nova permissão granular (módulo "site")
-- ============================================================================
insert into public.permissoes (codigo, nome, modulo, descricao)
values (
  'gerenciar_site_empresa',
  'Gerenciar Site e Branding da Empresa',
  'site',
  'Permite gerenciar domínios, subdomínios e branding (logo, cores, textos, SEO) da própria empresa'
)
on conflict (codigo) do update set
  nome = excluded.nome,
  modulo = excluded.modulo,
  descricao = excluded.descricao;

-- Vincula a permissão nova ao papel de sistema admin_empresa (superadmin já tem
-- acesso total via is_platform_superadmin()); segue o mesmo padrão da 043.
do $$
declare
  v_role_admin_empresa uuid;
  v_perm_id uuid;
begin
  select id into v_role_admin_empresa from public.papeis where codigo = 'admin_empresa' and empresa_id is null;
  select id into v_perm_id from public.permissoes where codigo = 'gerenciar_site_empresa';

  if v_role_admin_empresa is not null and v_perm_id is not null then
    insert into public.papel_permissoes (papel_id, permissao_id)
    values (v_role_admin_empresa, v_perm_id)
    on conflict do nothing;
  end if;
end $$;

-- ============================================================================
-- 4. Seed: domínio e branding da Gauchinho (valores idênticos aos já publicados)
-- ============================================================================
do $$
declare
  v_empresa_gauchinho uuid;
begin
  select id into v_empresa_gauchinho from public.empresas where slug = 'gauchinho';

  if not exists (
    select 1 from public.empresa_dominios
    where empresa_id = v_empresa_gauchinho
      and valor = 'gauchinhoconsorcios.com.br'
  ) then
    insert into public.empresa_dominios (empresa_id, tipo, valor, principal, ativo, verificado)
    values (v_empresa_gauchinho, 'DOMINIO_CUSTOMIZADO', 'gauchinhoconsorcios.com.br', true, true, true);
  end if;

  insert into public.empresa_branding (
    empresa_id, nome_site, subtitulo, descricao_institucional,
    logo_url, logo_claro_url, logo_escuro_url, favicon_url,
    cor_primaria, cor_secundaria, cor_destaque,
    telefone, whatsapp, email_contato, status_publicacao
  )
  values (
    v_empresa_gauchinho,
    'Gauchinho Escritório de Soluções Financeiras',
    '',
    '',
    null, null, null, null,
    '#0A1628', '#0D1F3C', '#C9A84C',
    '', '', '',
    'PUBLICADO'
  )
  on conflict (empresa_id) do nothing;
end $$;

-- ============================================================================
-- 5. Seed: Empresa B — tenant fictício (sem domínio, sem usuários, sem vínculos)
-- ============================================================================
insert into public.empresas (slug, razao_social, nome_fantasia, cnpj, status, ativo)
values (
  'empresa-b',
  'Empresa B Consórcios LTDA — Tenant fictício de demonstração',
  'Empresa B Consórcios',
  null,
  'em_treinamento',
  false
)
on conflict (slug) do nothing;

do $$
declare
  v_empresa_b uuid;
begin
  select id into v_empresa_b from public.empresas where slug = 'empresa-b';

  if v_empresa_b is null then
    raise exception 'Falha ao criar/localizar empresa-b';
  end if;

  insert into public.empresa_branding (
    empresa_id, nome_site, subtitulo, descricao_institucional,
    logo_url, logo_claro_url, logo_escuro_url, favicon_url,
    cor_primaria, cor_secundaria, cor_destaque,
    telefone, whatsapp, email_contato, status_publicacao
  )
  values (
    v_empresa_b,
    'Empresa B Consórcios',
    'Tenant de demonstração (dados fictícios)',
    'Empresa de demonstração usada para validar o isolamento multiempresa da plataforma.',
    null, null, null, null,
    '#1B2E1B', '#294529', '#7FB77E',
    '', '', '',
    'RASCUNHO'
  )
  on conflict (empresa_id) do nothing;
end $$;

-- Nenhuma linha em empresa_dominios para a Empresa B (proposital).
-- Nenhuma linha em empresa_usuarios (sem login/usuários nesta fase).

-- ============================================================================
-- 6. Concessão de privilégios isolada às 2 tabelas desta migration
-- ============================================================================
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant usage on schema public to authenticated;

    grant select, insert, update, delete on table
      public.empresa_dominios,
      public.empresa_branding
    to authenticated;

    grant all on table
      public.empresa_dominios,
      public.empresa_branding
    to service_role;

    revoke all on table
      public.empresa_dominios,
      public.empresa_branding
    from anon;
  end if;
end $$;

-- ============================================================================
-- 7. RLS (mesmo padrão da 043)
-- ============================================================================
alter table public.empresa_dominios enable row level security;
alter table public.empresa_branding enable row level security;

-- EMPRESA_DOMINIOS
drop policy if exists empresa_dominios_select_policy on public.empresa_dominios;
create policy empresa_dominios_select_policy on public.empresa_dominios
  for select to authenticated
  using (
    public.is_platform_superadmin() or
    public.is_company_member(empresa_id)
  );

drop policy if exists empresa_dominios_write_policy on public.empresa_dominios;
create policy empresa_dominios_write_policy on public.empresa_dominios
  for all to authenticated
  using (
    public.is_platform_superadmin() or
    public.has_company_permission(empresa_id, 'gerenciar_site_empresa')
  )
  with check (
    public.is_platform_superadmin() or
    public.has_company_permission(empresa_id, 'gerenciar_site_empresa')
  );

-- EMPRESA_BRANDING
drop policy if exists empresa_branding_select_policy on public.empresa_branding;
create policy empresa_branding_select_policy on public.empresa_branding
  for select to authenticated
  using (
    public.is_platform_superadmin() or
    public.is_company_member(empresa_id)
  );

drop policy if exists empresa_branding_write_policy on public.empresa_branding;
create policy empresa_branding_write_policy on public.empresa_branding
  for all to authenticated
  using (
    public.is_platform_superadmin() or
    public.has_company_permission(empresa_id, 'gerenciar_site_empresa')
  )
  with check (
    public.is_platform_superadmin() or
    public.has_company_permission(empresa_id, 'gerenciar_site_empresa')
  );

commit;
