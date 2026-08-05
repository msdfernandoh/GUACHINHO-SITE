-- ============================================================================
-- Migration 043: Fundação SaaS Multiempresa (Empresas, Usuários, Papéis e Permissões)
-- ============================================================================

-- 1. Tabela de Empresas (companies)
create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  razao_social text not null,
  nome_fantasia text not null,
  cnpj text,
  status text not null default 'ativo' check (status in ('ativo', 'suspenso', 'cancelado', 'em_treinamento')),
  ativo boolean not null default true,
  configuracoes jsonb not null default '{}'::jsonb,
  created_by uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists empresas_slug_idx on public.empresas (slug);
create index if not exists empresas_ativo_idx on public.empresas (ativo);

-- 2. Tabela de Papéis/Funções (roles)
create table if not exists public.papeis (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  descricao text,
  escopo text not null default 'COMPANY' check (escopo in ('PLATFORM', 'COMPANY')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists papeis_codigo_idx on public.papeis (codigo);

-- 3. Tabela de Permissões Granulares (permissions)
create table if not exists public.permissoes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  modulo text not null,
  descricao text,
  created_at timestamptz not null default now()
);

create index if not exists permissoes_codigo_idx on public.permissoes (codigo);
create index if not exists permissoes_modulo_idx on public.permissoes (modulo);

-- 4. Tabela de Junção Papéis-Permissões (role_permissions)
create table if not exists public.papel_permissoes (
  papel_id uuid not null references public.papeis (id) on delete cascade,
  permissao_id uuid not null references public.permissoes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (papel_id, permissao_id)
);

-- 5. Tabela N:N Vínculo Empresa-Usuário (company_users)
create table if not exists public.empresa_usuarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  papel_id uuid not null references public.papeis (id) on delete restrict,
  ativo boolean not null default true,
  data_entrada timestamptz not null default now(),
  data_saida timestamptz,
  convidado_por uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint empresa_usuarios_unica_ativa unique (empresa_id, usuario_id)
);

create index if not exists empresa_usuarios_empresa_idx on public.empresa_usuarios (empresa_id);
create index if not exists empresa_usuarios_usuario_idx on public.empresa_usuarios (usuario_id);
create index if not exists empresa_usuarios_papel_idx on public.empresa_usuarios (papel_id);

-- Trigger de updated_at para novas tabelas
create trigger empresas_updated_at before update on public.empresas
  for each row execute function public.set_updated_at();

create trigger papeis_updated_at before update on public.papeis
  for each row execute function public.set_updated_at();

create trigger empresa_usuarios_updated_at before update on public.empresa_usuarios
  for each row execute function public.set_updated_at();

-- ============================================================================
-- SEED DE PAPÉIS E PERMISSÕES INICIAIS (Idempotente)
-- ============================================================================

insert into public.papeis (codigo, nome, descricao, escopo)
values
  ('super_admin', 'SuperAdmin Plataforma', 'Acesso global irrestrito a todas as empresas e configurações da plataforma', 'PLATFORM'),
  ('admin_empresa', 'Administrador da Empresa', 'Gestão completa da empresa, configurações, usuários e relatórios', 'COMPANY'),
  ('gestor', 'Gestor Comercial', 'Gestão operacional de leads, propostas, agenda e equipe comercial', 'COMPANY'),
  ('consultor', 'Consultor / SRD', 'Operação de leads, propostas e atendimento ao cliente', 'COMPANY'),
  ('parceiro_imobiliaria', 'Parceiro Imobiliária', 'Acesso restrito ao módulo de imobiliárias e imóveis próprios', 'COMPANY'),
  ('visualizador', 'Visualizador', 'Acesso apenas de leitura para acompanhamento', 'COMPANY')
on conflict (codigo) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  escopo = excluded.escopo;

insert into public.permissoes (codigo, nome, modulo, descricao)
values
  ('gerenciar_empresas', 'Gerenciar Empresas', 'saas', 'Permite criar e alterar empresas no SaaS'),
  ('gerenciar_usuarios', 'Gerenciar Usuários', 'usuarios', 'Permite gerenciar usuários e acessos'),
  ('gerenciar_configuracoes', 'Gerenciar Configurações', 'configuracoes', 'Permite alterar configurações do sistema'),
  ('gerenciar_grupos', 'Gerenciar Grupos', 'grupos', 'Permite criar e editar grupos e cotas'),
  ('gerenciar_leads', 'Gerenciar Leads', 'leads', 'Permite manipular leads no CRM'),
  ('gerenciar_propostas', 'Gerenciar Propostas', 'propostas', 'Permite criar e enviar propostas'),
  ('acessar_agenda', 'Acessar Agenda', 'agenda', 'Permite visualizar e agendar compromissos'),
  ('acessar_relatorios', 'Acessar Relatórios', 'relatorios', 'Permite visualizar relatórios gerenciais')
on conflict (codigo) do update set
  nome = excluded.nome,
  modulo = excluded.modulo,
  descricao = excluded.descricao;

-- ============================================================================
-- CADASTRAR GAUCHINHO CONSÓRCIOS COMO EMPRESA INICIAL (Idempotente)
-- ============================================================================

insert into public.empresas (slug, razao_social, nome_fantasia, cnpj, status, ativo)
values (
  'gauchinho',
  'Gauchinho Escritório de Soluções Financeiras LTDA',
  'Gauchinho Consórcios',
  null,
  'ativo',
  true
)
on conflict (slug) do update set
  nome_fantasia = excluded.nome_fantasia,
  razao_social = excluded.razao_social;

-- ============================================================================
-- BACKFILL: ASSOCIAR TODOS OS USUÁRIOS ATUAIS À GAUCHINHO CONSÓRCIOS
-- ============================================================================

do $$
declare
  v_empresa_id uuid;
  v_role_super_admin uuid;
  v_role_admin_empresa uuid;
  v_role_consultor uuid;
  v_role_imobiliaria uuid;
  v_role_visualizador uuid;
begin
  -- Buscar IDs
  select id into v_empresa_id from public.empresas where slug = 'gauchinho';
  select id into v_role_super_admin from public.papeis where codigo = 'super_admin';
  select id into v_role_admin_empresa from public.papeis where codigo = 'admin_empresa';
  select id into v_role_consultor from public.papeis where codigo = 'consultor';
  select id into v_role_imobiliaria from public.papeis where codigo = 'parceiro_imobiliaria';
  select id into v_role_visualizador from public.papeis where codigo = 'visualizador';

  if v_empresa_id is not null then
    -- Associar cada usuário da tabela public.usuarios ao tenant Gauchinho conforme perfil atual
    insert into public.empresa_usuarios (empresa_id, usuario_id, papel_id, ativo)
    select
      v_empresa_id,
      u.id,
      case
        when u.perfil = 'master' then v_role_super_admin
        when u.perfil = 'srd' then v_role_consultor
        when u.perfil = 'imobiliaria' then v_role_imobiliaria
        when u.perfil = 'visualizador' then v_role_visualizador
        else v_role_consultor
      end,
      u.ativo
    from public.usuarios u
    on conflict (empresa_id, usuario_id) do update set
      ativo = excluded.ativo,
      papel_id = excluded.papel_id;
  end if;
end $$;

-- ============================================================================
-- FUNÇÕES POSTGRESQL AUXILIARES DE RLS (SECURITY DEFINER)
-- ============================================================================

-- Obter ID do perfil operacional do usuário autenticado atual
create or replace function public.current_usuario_id()
returns uuid as $$
  select u.id
  from public.usuarios u
  where u.auth_user_id = auth.uid()
    and u.ativo = true
  limit 1;
$$ language sql security definer set search_path = public;

-- Verifica se usuário é SuperAdmin da Plataforma
create or replace function public.is_platform_superadmin()
returns boolean as $$
  select exists (
    select 1
    from public.empresa_usuarios eu
    join public.papeis p on p.id = eu.papel_id
    where eu.usuario_id = public.current_usuario_id()
      and eu.ativo = true
      and p.codigo = 'super_admin'
      and p.ativo = true
  );
$$ language sql security definer set search_path = public;

-- Verifica se usuário é membro ativo da empresa informada
create or replace function public.is_company_member(p_empresa_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.empresa_usuarios eu
    where eu.empresa_id = p_empresa_id
      and eu.usuario_id = public.current_usuario_id()
      and eu.ativo = true
  ) or public.is_platform_superadmin();
$$ language sql security definer set search_path = public;

-- Verifica se usuário possui um determinado papel na empresa
create or replace function public.has_company_role(p_empresa_id uuid, p_role_code text)
returns boolean as $$
  select exists (
    select 1
    from public.empresa_usuarios eu
    join public.papeis p on p.id = eu.papel_id
    where eu.empresa_id = p_empresa_id
      and eu.usuario_id = public.current_usuario_id()
      and eu.ativo = true
      and p.codigo = p_role_code
      and p.ativo = true
  ) or public.is_platform_superadmin();
$$ language sql security definer set search_path = public;

-- ============================================================================
-- POLÍTICAS DE SEGURANÇA (RLS) PARA AS TABELAS DA FUNDAÇÃO
-- ============================================================================

alter table public.empresas enable row level security;
alter table public.papeis enable row level security;
alter table public.permissoes enable row level security;
alter table public.papel_permissoes enable row level security;
alter table public.empresa_usuarios enable row level security;

-- Empresas: membros ativos visualizam a própria empresa; superadmin visualiza todas
create policy empresas_select_policy on public.empresas
  for select to authenticated
  using (
    public.is_platform_superadmin() or
    id in (
      select eu.empresa_id
      from public.empresa_usuarios eu
      where eu.usuario_id = public.current_usuario_id()
        and eu.ativo = true
    )
  );

create policy empresas_all_superadmin on public.empresas
  for all to authenticated
  using (public.is_platform_superadmin());

-- Papéis e Permissões: leitura para todos autenticados; edição apenas superadmin
create policy papeis_select_policy on public.papeis
  for select to authenticated using (true);

create policy papeis_all_superadmin on public.papeis
  for all to authenticated using (public.is_platform_superadmin());

create policy permissoes_select_policy on public.permissoes
  for select to authenticated using (true);

create policy permissoes_all_superadmin on public.permissoes
  for all to authenticated using (public.is_platform_superadmin());

create policy papel_permissoes_select_policy on public.papel_permissoes
  for select to authenticated using (true);

create policy papel_permissoes_all_superadmin on public.papel_permissoes
  for all to authenticated using (public.is_platform_superadmin());

-- Empresa Usuarios: membro visualiza vínculos da sua empresa ou próprio vínculo
create policy empresa_usuarios_select_policy on public.empresa_usuarios
  for select to authenticated
  using (
    public.is_platform_superadmin() or
    usuario_id = public.current_usuario_id() or
    public.is_company_member(empresa_id)
  );

create policy empresa_usuarios_write_policy on public.empresa_usuarios
  for all to authenticated
  using (
    public.is_platform_superadmin() or
    public.has_company_role(empresa_id, 'admin_empresa')
  );
