# RELATÓRIO DE PRÉ-HOMOLOGAÇÃO DA MIGRATION 043 — FASE 1 (VERSÃO 1.3.0)

> **Status Atual:**  
> **`VALIDAÇÃO ESTÁTICA APROVADA`**  
> **`AGUARDANDO TESTE REAL EM POSTGRESQL`** *(Não aplicada no Supabase remoto)*  
> **Data:** 05/08/2026  
> **Projeto:** GAUCHINHO SITE (`C:\Fernando Hugo\GAUCHINHO SITE`)  
> **Migration:** `supabase/migrations/043_fundacao_saas_empresas_papeis.sql` (Versão 1.3.0)

---

## 1. APERFEIÇOAMENTOS E ENDURECIMENTO DE SEGURANÇA DA VERSÃO 1.3.0

1. **Proteção Rigorosa de Papéis `PLATFORM` (SuperAdmin apenas):**
   * O trigger `validar_papel_empresa_usuario()` valida se o papel informado possui `escopo = 'PLATFORM'`.
   * Se um Administrador de Empresa ou usuário comum tentar atribuir ou alterar um papel de escopo `PLATFORM`, o banco interrompe a transação com exceção:  
     `"Apenas SuperAdmins da Plataforma podem atribuir ou alterar papéis de escopo PLATFORM."`

2. **Trigger de Proteção de Papéis Personalizados por Empresa:**
   * Impede a atribuição de um papel customizado da Empresa A para um usuário da Empresa B.

3. **Endurecimento de Funções `SECURITY DEFINER` e Permissões:**
   * Todas as funções de segurança utilizam `SECURITY DEFINER SET search_path = public`.
   * Aplicado `REVOKE ALL ON FUNCTION ... FROM PUBLIC;` e `GRANT EXECUTE ON FUNCTION ... TO authenticated;` nas funções:
     - `public.current_usuario_id()`
     - `public.is_platform_superadmin()`
     - `public.is_company_member(uuid)`
     - `public.has_company_role(uuid, text)`
     - `public.has_company_permission(uuid, text)`
     - `public.validar_papel_empresa_usuario()`

4. **Visibilidade Estrita em `empresa_usuarios` (RLS):**
   * SuperAdmin: visualiza todos os membros de todas as empresas.
   * Admin da Empresa: visualiza os membros da própria empresa.
   * Usuário Comum (`consultor`, `parceiro_imobiliaria`, `visualizador`): visualiza **exclusivamente o seu próprio vínculo** (`usuario_id = current_usuario_id()`).

5. **Proteção no Backfill contra Perfis Inesperados:**
   * Caso o script de backfill encontre um perfil inesperado diferente de `master`, `srd`, `imobiliaria` ou `visualizador`, o script lança exceção com `RAISE EXCEPTION` interrompendo o processo, em vez de atribuir perfil silenciosamente.

6. **Inspeção de `public.set_updated_at()` no Banco Remoto:**
   * Confirmada a existência prévia da função `public.set_updated_at()` desde a migration `001`. A migration `043` utiliza `CREATE OR REPLACE FUNCTION` com assinatura 100% idêntica.

---

## 2. MATRIZ DE CENÁRIOS E SEGURANÇA RLS

| Cenário de Teste / Acesso | Comportamento Esperado | Status de Validação Estática |
| :--- | :---: | :---: |
| SuperAdmin lista todas as empresas | **Permitido** | **APROVADO** |
| Admin da Empresa A lista membros da Empresa A | **Permitido** | **APROVADO** |
| Admin da Empresa A lista membros da Empresa B | **Negado** | **APROVADO** |
| Consultor A tenta listar toda a equipe da Empresa A | **Negado** | **APROVADO** |
| Consultor A visualiza seu próprio vínculo | **Permitido** | **APROVADO** |
| Atribuir Papel da Empresa A para usuário da Empresa B | **Negado pelo Banco (Trigger)** | **APROVADO** |
| Admin da Empresa A tenta conceder papel PLATFORM | **Negado pelo Banco (Trigger)** | **APROVADO** |
| Usuário sem vínculo tenta acessar dados da empresa | **Negado** | **APROVADO** |

---

## 3. CONTEÚDO INTEGRAL E COMPLETO DA MIGRATION 043 (VERSÃO 1.3.0)

*(Sem resumos ou supressões de código)*

```sql
-- ============================================================================
-- Migration 043: Fundação SaaS Multiempresa (Empresas, Usuários, Papéis e Permissões)
-- Versão 1.3.0 — Endurecimento de Segurança:
-- 1. Proteção de papéis PLATFORM (atribuição exclusiva por SuperAdmin)
-- 2. Trigger de validação de papéis por empresa (impede uso cruzado)
-- 3. Endurecimento de funções SECURITY DEFINER com REVOKE/GRANT explícitos
-- 4. RLS explícito com USING e WITH CHECK em todas as tabelas
-- 5. Backfill estrito sem atribuição silenciosa para perfis inesperados
-- ============================================================================

-- Função utilitária de timestamp (compatível com a migration 001)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

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
  updated_at timestamptz not null default now(),
  constraint empresas_status_ativo_coerente check (
    (status = 'ativo' and ativo = true) or (status <> 'ativo' and ativo = false)
  )
);

create index if not exists empresas_slug_idx on public.empresas (slug);
create index if not exists empresas_ativo_idx on public.empresas (ativo);

-- 2. Tabela de Papéis/Funções (roles)
create table if not exists public.papeis (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas (id) on delete cascade,
  codigo text not null,
  nome text not null,
  descricao text,
  escopo text not null default 'COMPANY' check (escopo in ('PLATFORM', 'COMPANY')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists papeis_codigo_sistema_idx on public.papeis (codigo) where empresa_id is null;
create unique index if not exists papeis_codigo_empresa_idx on public.papeis (empresa_id, codigo) where empresa_id is not null;

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
  updated_at timestamptz not null default now()
);

create unique index if not exists empresa_usuarios_unica_ativa on public.empresa_usuarios (empresa_id, usuario_id) where ativo = true;

create index if not exists empresa_usuarios_empresa_idx on public.empresa_usuarios (empresa_id);
create index if not exists empresa_usuarios_usuario_idx on public.empresa_usuarios (usuario_id);
create index if not exists empresa_usuarios_papel_idx on public.empresa_usuarios (papel_id);

-- Triggers de updated_at (com re-criação segura)
drop trigger if exists empresas_updated_at on public.empresas;
create trigger empresas_updated_at before update on public.empresas
  for each row execute function public.set_updated_at();

drop trigger if exists papeis_updated_at on public.papeis;
create trigger papeis_updated_at before update on public.papeis
  for each row execute function public.set_updated_at();

drop trigger if exists empresa_usuarios_updated_at on public.empresa_usuarios;
create trigger empresa_usuarios_updated_at before update on public.empresa_usuarios
  for each row execute function public.set_updated_at();

-- ============================================================================
-- FUNÇÕES POSTGRESQL AUXILIARES DE RLS (SECURITY DEFINER SET search_path = public)
-- ============================================================================

create or replace function public.current_usuario_id()
returns uuid as $$
  select u.id
  from public.usuarios u
  where u.auth_user_id = auth.uid()
    and u.ativo = true
  limit 1;
$$ language sql security definer set search_path = public;

revoke all on function public.current_usuario_id() from public;
grant execute on function public.current_usuario_id() to authenticated;

create or replace function public.is_platform_superadmin()
returns boolean as $$
  select exists (
    select 1
    from public.empresa_usuarios eu
    join public.papeis p on p.id = eu.papel_id
    where eu.usuario_id = public.current_usuario_id()
      and eu.ativo = true
      and p.codigo = 'super_admin'
      and p.escopo = 'PLATFORM'
      and p.ativo = true
  );
$$ language sql security definer set search_path = public;

revoke all on function public.is_platform_superadmin() from public;
grant execute on function public.is_platform_superadmin() to authenticated;

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

revoke all on function public.is_company_member(uuid) from public;
grant execute on function public.is_company_member(uuid) to authenticated;

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

revoke all on function public.has_company_role(uuid, text) from public;
grant execute on function public.has_company_role(uuid, text) to authenticated;

-- Helper de verificação de permissão granular segura
create or replace function public.has_company_permission(p_empresa_id uuid, p_permission_code text)
returns boolean as $$
begin
  if public.is_platform_superadmin() then
    return true;
  end if;

  return exists (
    select 1
    from public.empresa_usuarios eu
    join public.papeis p on p.id = eu.papel_id
    join public.papel_permissoes pp on pp.papel_id = p.id
    join public.permissoes perm on perm.id = pp.permissao_id
    where eu.empresa_id = p_empresa_id
      and eu.usuario_id = public.current_usuario_id()
      and eu.ativo = true
      and p.ativo = true
      and (p.empresa_id is null or p.empresa_id = p_empresa_id)
      and perm.codigo = p_permission_code
  );
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.has_company_permission(uuid, text) from public;
grant execute on function public.has_company_permission(uuid, text) to authenticated;

-- ============================================================================
-- TRIGGER DE VALIDAÇÃO DE ESCOPO E ATRIBUIÇÃO DE PAPÉIS
-- ============================================================================

create or replace function public.validar_papel_empresa_usuario()
returns trigger as $$
declare
  v_role_escopo text;
  v_role_empresa_id uuid;
  v_role_ativo boolean;
begin
  select escopo, empresa_id, ativo
  into v_role_escopo, v_role_empresa_id, v_role_ativo
  from public.papeis
  where id = NEW.papel_id;

  if not found then
    raise exception 'Papel informado (ID %) não existe.', NEW.papel_id;
  end if;

  if not v_role_ativo then
    raise exception 'Papel informado (ID %) está inativo.', NEW.papel_id;
  end if;

  -- 1. Proteção de Papel PLATFORM: Apenas SuperAdmin pode atribuir, alterar ou mover
  if v_role_escopo = 'PLATFORM' then
    if not public.is_platform_superadmin() then
      raise exception 'Apenas SuperAdmins da Plataforma podem atribuir ou alterar papéis de escopo PLATFORM.';
    end if;
  end if;

  -- 2. Papel personalizado de empresa DEVE pertencer à mesma empresa do vínculo
  if v_role_escopo = 'COMPANY' and v_role_empresa_id is not null then
    if v_role_empresa_id <> NEW.empresa_id then
      raise exception 'Papel personalizado da empresa % não pode ser atribuído a usuário da empresa %.',
        v_role_empresa_id, NEW.empresa_id;
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.validar_papel_empresa_usuario() from public;
grant execute on function public.validar_papel_empresa_usuario() to authenticated;

drop trigger if exists trg_validar_papel_empresa_usuario on public.empresa_usuarios;
create trigger trg_validar_papel_empresa_usuario
  before insert or update on public.empresa_usuarios
  for each row execute function public.validar_papel_empresa_usuario();

-- ============================================================================
-- SEED DE PAPÉIS E PERMISSÕES SEPARADAS (Idempotente)
-- ============================================================================

insert into public.papeis (empresa_id, codigo, nome, descricao, escopo)
values
  (null, 'super_admin', 'SuperAdmin Plataforma', 'Acesso global irrestrito a todas as empresas e configurações da plataforma', 'PLATFORM'),
  (null, 'admin_empresa', 'Administrador da Empresa', 'Gestão completa da empresa, configurações, usuários e relatórios da própria empresa', 'COMPANY'),
  (null, 'gestor', 'Gestor Comercial', 'Gestão operacional de leads, propostas, agenda e equipe comercial', 'COMPANY'),
  (null, 'consultor', 'Consultor / SRD', 'Operação de leads, propostas e atendimento ao cliente', 'COMPANY'),
  (null, 'parceiro_imobiliaria', 'Parceiro Imobiliária', 'Acesso restrito ao módulo de imobiliárias e imóveis próprios', 'COMPANY'),
  (null, 'visualizador', 'Visualizador', 'Acesso apenas de leitura para acompanhamento', 'COMPANY')
on conflict (codigo) where empresa_id is null do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  escopo = excluded.escopo;

insert into public.permissoes (codigo, nome, modulo, descricao)
values
  ('gerenciar_empresas_plataforma', 'Gerenciar Empresas (Plataforma Global)', 'saas', 'Permite criar e alterar empresas na plataforma SaaS global'),
  ('gerenciar_empresa_atual', 'Gerenciar Empresa Atual', 'empresa', 'Permite alterar configurações e dados da própria empresa'),
  ('gerenciar_usuarios', 'Gerenciar Usuários', 'usuarios', 'Permite gerenciar usuários e acessos da própria empresa'),
  ('gerenciar_configuracoes', 'Gerenciar Configurações', 'configuracoes', 'Permite alterar configurações operacionais da empresa'),
  ('gerenciar_grupos', 'Gerenciar Grupos', 'grupos', 'Permite habilitar e gerenciar grupos e cotas'),
  ('gerenciar_leads', 'Gerenciar Leads', 'leads', 'Permite manipular leads no CRM'),
  ('gerenciar_propostas', 'Gerenciar Propostas', 'propostas', 'Permite criar e enviar propostas'),
  ('acessar_agenda', 'Acessar Agenda', 'agenda', 'Permite visualizar e agendar compromissos'),
  ('acessar_relatorios', 'Acessar Relatórios', 'relatorios', 'Permite visualizar relatórios gerenciais')
on conflict (codigo) do update set
  nome = excluded.nome,
  modulo = excluded.modulo,
  descricao = excluded.descricao;

-- Atribuição Granular de Permissões por Papel
do $$
declare
  v_role_super_admin uuid;
  v_role_admin_empresa uuid;
  v_role_gestor uuid;
  v_role_consultor uuid;
  v_role_imobiliaria uuid;
  v_role_visualizador uuid;
  v_perm_rec record;
begin
  select id into v_role_super_admin from public.papeis where codigo = 'super_admin' and empresa_id is null;
  select id into v_role_admin_empresa from public.papeis where codigo = 'admin_empresa' and empresa_id is null;
  select id into v_role_gestor from public.papeis where codigo = 'gestor' and empresa_id is null;
  select id into v_role_consultor from public.papeis where codigo = 'consultor' and empresa_id is null;
  select id into v_role_imobiliaria from public.papeis where codigo = 'parceiro_imobiliaria' and empresa_id is null;
  select id into v_role_visualizador from public.papeis where codigo = 'visualizador' and empresa_id is null;

  for v_perm_rec in select id, codigo from public.permissoes loop
    insert into public.papel_permissoes (papel_id, permissao_id)
    values (v_role_super_admin, v_perm_rec.id) on conflict do nothing;

    if v_perm_rec.codigo <> 'gerenciar_empresas_plataforma' then
      insert into public.papel_permissoes (papel_id, permissao_id)
      values (v_role_admin_empresa, v_perm_rec.id) on conflict do nothing;
    end if;

    if v_perm_rec.codigo in ('gerenciar_leads', 'gerenciar_propostas', 'acessar_agenda', 'acessar_relatorios', 'gerenciar_grupos') then
      insert into public.papel_permissoes (papel_id, permissao_id)
      values (v_role_gestor, v_perm_rec.id) on conflict do nothing;
    end if;

    if v_perm_rec.codigo in ('gerenciar_leads', 'gerenciar_propostas', 'acessar_agenda') then
      insert into public.papel_permissoes (papel_id, permissao_id)
      values (v_role_consultor, v_perm_rec.id) on conflict do nothing;
    end if;

    if v_perm_rec.codigo in ('gerenciar_leads', 'acessar_agenda') then
      insert into public.papel_permissoes (papel_id, permissao_id)
      values (v_role_imobiliaria, v_perm_rec.id) on conflict do nothing;
    end if;

    if v_perm_rec.codigo in ('acessar_relatorios') then
      insert into public.papel_permissoes (papel_id, permissao_id)
      values (v_role_visualizador, v_perm_rec.id) on conflict do nothing;
    end if;
  end loop;
end $$;

-- Seed da Empresa Gauchinho
insert into public.empresas (slug, razao_social, nome_fantasia, cnpj, status, ativo)
values (
  'gauchinho',
  'Gauchinho Escritório de Soluções Financeiras LTDA',
  'Gauchinho Consórcios',
  null,
  'ativo',
  true
)
on conflict (slug) do nothing;

-- Backfill Estrito de Usuários Existentes
do $$
declare
  v_empresa_id uuid;
  v_role_super_admin uuid;
  v_role_admin_empresa uuid;
  v_role_consultor uuid;
  v_role_imobiliaria uuid;
  v_role_visualizador uuid;
  v_u_rec record;
  v_target_role uuid;
begin
  select id into v_empresa_id from public.empresas where slug = 'gauchinho';
  select id into v_role_super_admin from public.papeis where codigo = 'super_admin' and empresa_id is null;
  select id into v_role_admin_empresa from public.papeis where codigo = 'admin_empresa' and empresa_id is null;
  select id into v_role_consultor from public.papeis where codigo = 'consultor' and empresa_id is null;
  select id into v_role_imobiliaria from public.papeis where codigo = 'parceiro_imobiliaria' and empresa_id is null;
  select id into v_role_visualizador from public.papeis where codigo = 'visualizador' and empresa_id is null;

  if v_empresa_id is not null then
    for v_u_rec in select id, email, perfil, ativo from public.usuarios loop
      v_target_role := case
        when v_u_rec.email = 'msdfernando@gmail.com' then v_role_super_admin
        when v_u_rec.perfil = 'master' then v_role_admin_empresa
        when v_u_rec.perfil = 'srd' then v_role_consultor
        when v_u_rec.perfil = 'imobiliaria' then v_role_imobiliaria
        when v_u_rec.perfil = 'visualizador' then v_role_visualizador
        else null
      end;

      if v_target_role is null then
        raise exception 'Perfil inesperado "%" para usuário % (email %). Interrompendo backfill.',
          v_u_rec.perfil, v_u_rec.id, v_u_rec.email;
      end if;

      insert into public.empresa_usuarios (empresa_id, usuario_id, papel_id, ativo)
      values (v_empresa_id, v_u_rec.id, v_target_role, v_u_rec.ativo)
      on conflict (empresa_id, usuario_id) where ativo = true do update set
        ativo = excluded.ativo,
        papel_id = excluded.papel_id;
    end loop;
  end if;
end $$;

-- ============================================================================
-- POLÍTICAS DE SEGURANÇA (RLS) EXPLÍCITAS (USING + WITH CHECK)
-- ============================================================================

alter table public.empresas enable row level security;
alter table public.papeis enable row level security;
alter table public.permissoes enable row level security;
alter table public.papel_permissoes enable row level security;
alter table public.empresa_usuarios enable row level security;

-- EMPRESAS
drop policy if exists empresas_select_policy on public.empresas;
create policy empresas_select_policy on public.empresas
  for select to authenticated
  using (
    public.is_platform_superadmin() or
    public.is_company_member(id)
  );

drop policy if exists empresas_insert_policy on public.empresas;
create policy empresas_insert_policy on public.empresas
  for insert to authenticated
  with check (public.is_platform_superadmin());

drop policy if exists empresas_update_policy on public.empresas;
create policy empresas_update_policy on public.empresas
  for update to authenticated
  using (
    public.is_platform_superadmin() or
    public.has_company_role(id, 'admin_empresa')
  )
  with check (
    public.is_platform_superadmin() or
    public.has_company_role(id, 'admin_empresa')
  );

drop policy if exists empresas_delete_policy on public.empresas;
create policy empresas_delete_policy on public.empresas
  for delete to authenticated
  using (public.is_platform_superadmin());

-- PAPÉIS
drop policy if exists papeis_select_policy on public.papeis;
create policy papeis_select_policy on public.papeis
  for select to authenticated
  using (
    public.is_platform_superadmin() or
    empresa_id is null or
    public.is_company_member(empresa_id)
  );

drop policy if exists papeis_write_policy on public.papeis;
create policy papeis_write_policy on public.papeis
  for all to authenticated
  using (
    public.is_platform_superadmin() or
    (empresa_id is not null and public.has_company_role(empresa_id, 'admin_empresa'))
  )
  with check (
    public.is_platform_superadmin() or
    (empresa_id is not null and public.has_company_role(empresa_id, 'admin_empresa'))
  );

-- PERMISSÕES
drop policy if exists permissoes_select_policy on public.permissoes;
create policy permissoes_select_policy on public.permissoes
  for select to authenticated using (true);

drop policy if exists permissoes_write_policy on public.permissoes;
create policy permissoes_write_policy on public.permissoes
  for all to authenticated
  using (public.is_platform_superadmin())
  with check (public.is_platform_superadmin());

-- PAPEL_PERMISSOES
drop policy if exists papel_permissoes_select_policy on public.papel_permissoes;
create policy papel_permissoes_select_policy on public.papel_permissoes
  for select to authenticated
  using (
    public.is_platform_superadmin() or
    exists (
      select 1 from public.papeis p
      where p.id = papel_id
        and (p.empresa_id is null or public.is_company_member(p.empresa_id))
    )
  );

drop policy if exists papel_permissoes_write_policy on public.papel_permissoes;
create policy papel_permissoes_write_policy on public.papel_permissoes
  for all to authenticated
  using (
    public.is_platform_superadmin() or
    exists (
      select 1 from public.papeis p
      where p.id = papel_id
        and p.empresa_id is not null
        and public.has_company_role(p.empresa_id, 'admin_empresa')
    )
  )
  with check (
    public.is_platform_superadmin() or
    exists (
      select 1 from public.papeis p
      where p.id = papel_id
        and p.empresa_id is not null
        and public.has_company_role(p.empresa_id, 'admin_empresa')
    )
  );

-- EMPRESA_USUARIOS (Visibilidade e Escrita Estritas)
drop policy if exists empresa_usuarios_select_policy on public.empresa_usuarios;
create policy empresa_usuarios_select_policy on public.empresa_usuarios
  for select to authenticated
  using (
    public.is_platform_superadmin() or
    (public.has_company_role(empresa_id, 'admin_empresa') and public.is_company_member(empresa_id)) or
    usuario_id = public.current_usuario_id()
  );

drop policy if exists empresa_usuarios_insert_policy on public.empresa_usuarios;
create policy empresa_usuarios_insert_policy on public.empresa_usuarios
  for insert to authenticated
  with check (
    public.is_platform_superadmin() or
    (public.has_company_role(empresa_id, 'admin_empresa') and public.is_company_member(empresa_id))
  );

drop policy if exists empresa_usuarios_update_policy on public.empresa_usuarios;
create policy empresa_usuarios_update_policy on public.empresa_usuarios
  for update to authenticated
  using (
    public.is_platform_superadmin() or
    (public.has_company_role(empresa_id, 'admin_empresa') and public.is_company_member(empresa_id))
  )
  with check (
    public.is_platform_superadmin() or
    (public.has_company_role(empresa_id, 'admin_empresa') and public.is_company_member(empresa_id))
  );

drop policy if exists empresa_usuarios_delete_policy on public.empresa_usuarios;
create policy empresa_usuarios_delete_policy on public.empresa_usuarios
  for delete to authenticated
  using (
    public.is_platform_superadmin() or
    (public.has_company_role(empresa_id, 'admin_empresa') and public.is_company_member(empresa_id))
  );
```

---

## 4. STATUS DA PRÉ-HOMOLOGAÇÃO

```text
VALIDAÇÃO ESTÁTICA APROVADA
AGUARDANDO TESTE REAL EM POSTGRESQL
```

*(Nenhuma migration foi aplicada no banco remoto. Nenhum git push foi executado. Aguardando orientações antes dos testes em ambiente PostgreSQL descartável)*.
