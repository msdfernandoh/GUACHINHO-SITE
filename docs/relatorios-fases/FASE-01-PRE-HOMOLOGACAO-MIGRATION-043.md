# RELATÓRIO DE PRÉ-HOMOLOGAÇÃO E AUDITORIA DE GRANTS — MIGRATION 043 (VERSÃO 1.9.0)

> **Status de Homologação:**  
> **`RLS VALIDADA EM SIMULADOR`**  
> **`CORREÇÃO DE GRANTS E AUDITORIA DE IMPACTO CONCLUÍDAS`**  
> **`NÃO APTA PARA PRODUÇÃO ATÉ AUTORIZAÇÃO EXPLÍCITA`** *(Nenhuma alteração no Supabase remoto)*  
> **Data:** 05/08/2026  
> **Projeto:** GAUCHINHO SITE (`C:\Fernando Hugo\GAUCHINHO SITE`)  
> **Migration:** `supabase/migrations/043_fundacao_saas_empresas_papeis.sql` (Versão 1.9.0)  

---

## 1. CORREÇÃO CRÍTICA DE PRIVILÉGIOS (VERSÃO 1.9.0)

### O que foi completamente REMOVIDO:
Foram removidos 100% dos comandos de concessão de privilégios globais que afetavam todas as tabelas do schema `public`:
* ~~`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;`~~ **(REMOVIDO)**
* ~~`GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;`~~ **(REMOVIDO)**
* ~~`GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;`~~ **(REMOVIDO)**

### O que foi APLICADO (Privilégios Restritos às 5 Novas Tabelas):
As concessões foram aplicadas exclusivamente sobre as 5 tabelas pertencentes à Migration 043 (`empresas`, `papeis`, `permissoes`, `papel_permissoes`, `empresa_usuarios`):

```sql
grant select, insert, update, delete on table
  public.empresas,
  public.papeis,
  public.permissoes,
  public.papel_permissoes,
  public.empresa_usuarios
to authenticated;

grant all on table
  public.empresas,
  public.papeis,
  public.permissoes,
  public.papel_permissoes,
  public.empresa_usuarios
to service_role;

revoke all on table
  public.empresas,
  public.papeis,
  public.permissoes,
  public.papel_permissoes,
  public.empresa_usuarios
from anon;
```

---

## 2. AUDITORIA DE IMPACTO NO BANCO REMOTO DE PRODUÇÃO (SOMENTE LEITURA)

Foi realizada auditoria de leitura no banco de produção (`eaeuoynprurmmulzhydt.supabase.co`) confirmando a existência e preservação intacta de 13 tabelas legadas do sistema:

| Tabela Legada | Status em Produção | Registros Atuais | Acesso ANON Atual | Impacto da Migration 043 v1.9.0 |
| :--- | :---: | :---: | :---: | :---: |
| `public.usuarios` | EXISTE | 7 | BLOQUEADO | **0 alteração de privilégios** |
| `public.leads` | EXISTE | 116 | BLOQUEADO | **0 alteração de privilégios** |
| `public.propostas` | EXISTE | 12 | BLOQUEADO | **0 alteração de privilégios** |
| `public.grupos_consorcio` | EXISTE | 19 | BLOQUEADO | **0 alteração de privilégios** |
| `public.grupos_cotas` | EXISTE | 178 | BLOQUEADO | **0 alteração de privilégios** |
| `public.contratacoes_online` | EXISTE | 17 | BLOQUEADO | **0 alteração de privilégios** |
| `public.agenda_eventos` | EXISTE | 0 | BLOQUEADO | **0 alteração de privilégios** |
| `public.indices_financeiros` | EXISTE | 8 | BLOQUEADO | **0 alteração de privilégios** |
| `public.casos_sucesso` | EXISTE | 2 | BLOQUEADO | **0 alteração de privilégios** |
| `public.depoimentos` | EXISTE | 0 | BLOQUEADO | **0 alteração de privilégios** |
| `public.faq` | EXISTE | 0 | BLOQUEADO | **0 alteração de privilégios** |
| `public.parceiros` | EXISTE | 3 | BLOQUEADO | **0 alteração de privilégios** |
| `public.imoveis` | EXISTE | 1 | BLOQUEADO | **0 alteração de privilégios** |

---

## 3. CONTEÚDO COMPLETO E INTEGRAL DA MIGRATION 043 (VERSÃO 1.9.0)

```sql
-- ============================================================================
-- Migration 043: Fundação SaaS Multiempresa (Empresas, Usuários, Papéis e Permissões)
-- Versão 1.9.0 — Concessão Restrita de Privilégios Exclusivamente às 5 Tabelas da 043:
-- 1. Remoção TOTAL de qualquer GRANT global em ALL TABLES IN SCHEMA public
-- 2. Concessão de GRANT SELECT, INSERT, UPDATE, DELETE estritamente sobre as 5 tabelas da 043 para authenticated
-- 3. Concessão de GRANT ALL estritamente sobre as 5 tabelas da 043 para service_role
-- 4. REVOKE ALL nas 5 tabelas da 043 para o papel anon (0 acesso público às estruturas SaaS)
-- 5. Nenhuma alteração de privilégios ou RLS em tabelas legadas (usuarios, leads, propostas, etc.)
-- 6. Transação atômica explícita (BEGIN ... COMMIT)
-- 7. Índice único parcial empresa_usuarios_backfill_inicial_unico_idx
-- ============================================================================

begin;

-- 1. Validação de dependência prévia por assinatura completa
do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_type t on t.oid = p.prorettype
    where n.nspname = 'public'
      and p.proname = 'set_updated_at'
      and t.typname = 'trigger'
      and p.pronargs = 0
  ) then
    raise exception 'Função necessária public.set_updated_at() com retorno trigger sem parâmetros não encontrada no schema. Execute as migrations 001 a 042 antes da 043.';
  end if;
end $$;

-- 2. Tabela de Empresas (companies)
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

-- 3. Tabela de Papéis/Funções (roles)
create table if not exists public.papeis (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas (id) on delete cascade,
  codigo text not null,
  nome text not null,
  descricao text,
  escopo text not null default 'COMPANY' check (escopo in ('PLATFORM', 'COMPANY')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint papeis_escopo_empresa_coerente check (
    (escopo = 'PLATFORM' and empresa_id is null) or (escopo = 'COMPANY')
  ),
  constraint papeis_codigo_reservado check (
    empresa_id is null or codigo not in ('super_admin', 'admin_empresa')
  )
);

create unique index if not exists papeis_codigo_sistema_idx on public.papeis (codigo) where empresa_id is null;
create unique index if not exists papeis_codigo_empresa_idx on public.papeis (empresa_id, codigo) where empresa_id is not null;

-- 4. Tabela de Permissões Granulares (permissions)
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

-- 5. Tabela de Junção Papéis-Permissões (role_permissions)
create table if not exists public.papel_permissoes (
  papel_id uuid not null references public.papeis (id) on delete cascade,
  permissao_id uuid not null references public.permissoes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (papel_id, permissao_id)
);

-- 6. Tabela N:N Vínculo Empresa-Usuário (company_users)
create table if not exists public.empresa_usuarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  papel_id uuid not null references public.papeis (id) on delete restrict,
  ativo boolean not null default true,
  data_entrada timestamptz not null default now(),
  data_saida timestamptz,
  convidado_por uuid references public.usuarios (id) on delete set null,
  origem text not null default 'MANUAL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint empresa_usuarios_ativo_saida_coerente check (
    (ativo = true and data_saida is null) or (ativo = false)
  )
);

create unique index if not exists empresa_usuarios_unica_ativa on public.empresa_usuarios (empresa_id, usuario_id) where ativo = true;
create unique index if not exists empresa_usuarios_backfill_inicial_unico_idx on public.empresa_usuarios (empresa_id, usuario_id) where origem = 'MIGRATION_043_INITIAL_BACKFILL';

create index if not exists empresa_usuarios_empresa_idx on public.empresa_usuarios (empresa_id);
create index if not exists empresa_usuarios_usuario_idx on public.empresa_usuarios (usuario_id);
create index if not exists empresa_usuarios_papel_idx on public.empresa_usuarios (papel_id);

-- Triggers de updated_at
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
grant execute on function public.current_usuario_id() to authenticated, service_role;

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
      and p.empresa_id is null
      and p.ativo = true
  );
$$ language sql security definer set search_path = public;

revoke all on function public.is_platform_superadmin() from public;
grant execute on function public.is_platform_superadmin() to authenticated, service_role;

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
grant execute on function public.is_company_member(uuid) to authenticated, service_role;

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
grant execute on function public.has_company_role(uuid, text) to authenticated, service_role;

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
grant execute on function public.has_company_permission(uuid, text) to authenticated, service_role;

-- ============================================================================
-- SEED DE PAPÉIS, PERMISSÕES E EMPRESA GAUCHINHO (Idempotente)
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

-- ============================================================================
-- PASSO OBRIGATÓRIO: REMOVER O TRIGGER ANTES DO BACKFILL (Garantia de Idempotência)
-- ============================================================================

drop trigger if exists trg_validar_papel_empresa_usuario on public.empresa_usuarios;

-- ============================================================================
-- BACKFILL CONTROLADO E NÃO-DESTRUTIVO DOS USUÁRIOS EXISTENTES
-- ============================================================================

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
  v_has_manual_active boolean;
  v_existing_backfill_id uuid;
  v_data_saida timestamptz;
begin
  select id into v_empresa_id from public.empresas where slug = 'gauchinho';
  select id into v_role_super_admin from public.papeis where codigo = 'super_admin' and empresa_id is null;
  select id into v_role_admin_empresa from public.papeis where codigo = 'admin_empresa' and empresa_id is null;
  select id into v_role_consultor from public.papeis where codigo = 'consultor' and empresa_id is null;
  select id into v_role_imobiliaria from public.papeis where codigo = 'parceiro_imobiliaria' and empresa_id is null;
  select id into v_role_visualizador from public.papeis where codigo = 'visualizador' and empresa_id is null;

  if v_empresa_id is not null then
    for v_u_rec in select id, email, perfil, ativo, created_at from public.usuarios loop
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

      select exists (
        select 1 from public.empresa_usuarios
        where empresa_id = v_empresa_id
          and usuario_id = v_u_rec.id
          and ativo = true
          and origem = 'MANUAL'
      ) into v_has_manual_active;

      if not v_has_manual_active then
        select id into v_existing_backfill_id
        from public.empresa_usuarios
        where empresa_id = v_empresa_id
          and usuario_id = v_u_rec.id
          and origem = 'MIGRATION_043_INITIAL_BACKFILL'
        limit 1;

        v_data_saida := case when v_u_rec.ativo then null else now() end;

        if v_existing_backfill_id is null then
          insert into public.empresa_usuarios (
            empresa_id, usuario_id, papel_id, ativo,
            data_entrada, data_saida, origem
          )
          values (
            v_empresa_id, v_u_rec.id, v_target_role, v_u_rec.ativo,
            coalesce(v_u_rec.created_at, now()), v_data_saida,
            'MIGRATION_043_INITIAL_BACKFILL'
          );
        else
          update public.empresa_usuarios
          set papel_id = v_target_role,
              ativo = v_u_rec.ativo,
              data_saida = v_data_saida
          where id = v_existing_backfill_id;
        end if;
      else
        raise notice 'Usuário % possui vínculo manual ativo. Vínculo manual mantido sem alteração de papel.', v_u_rec.email;
      end if;
    end loop;
  end if;
end $$;

-- ============================================================================
-- TRIGGER DE VALIDAÇÃO COMPLETA (Protege INSERT, UPDATE e DELETE)
-- ============================================================================

create or replace function public.validar_papel_empresa_usuario()
returns trigger as $$
declare
  v_role_escopo text;
  v_role_empresa_id uuid;
  v_role_ativo boolean;
  v_old_role_escopo text;
begin
  if TG_OP = 'DELETE' then
    select escopo into v_old_role_escopo from public.papeis where id = OLD.papel_id;
    if v_old_role_escopo = 'PLATFORM' and not public.is_platform_superadmin() then
      raise exception 'Apenas SuperAdmins da Plataforma podem excluir ou remover vínculos com papel PLATFORM.';
    end if;
    return OLD;
  end if;

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

  if TG_OP = 'UPDATE' then
    select escopo into v_old_role_escopo from public.papeis where id = OLD.papel_id;
    if (v_old_role_escopo = 'PLATFORM' or v_role_escopo = 'PLATFORM') and not public.is_platform_superadmin() then
      raise exception 'Apenas SuperAdmins da Plataforma podem alterar, desativar ou rebaixar papéis de escopo PLATFORM.';
    end if;
  else
    if v_role_escopo = 'PLATFORM' and not public.is_platform_superadmin() then
      raise exception 'Apenas SuperAdmins da Plataforma podem atribuir papéis de escopo PLATFORM.';
    end if;
  end if;

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

drop trigger if exists trg_validar_papel_empresa_usuario on public.empresa_usuarios;
create trigger trg_validar_papel_empresa_usuario
  before insert or update or delete on public.empresa_usuarios
  for each row execute function public.validar_papel_empresa_usuario();

-- ============================================================================
-- CONCESSÃO DE PRIVILÉGIOS ISOLADA E RESTRITA ÀS 5 TABELAS DA MIGRATION 043
-- (Nenhuma alteração de privilégios ou RLS em tabelas legadas do schema public)
-- ============================================================================

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    -- Garantir apenas o uso do schema public
    grant usage on schema public to authenticated;

    -- Conceder permissões SELECT, INSERT, UPDATE, DELETE EXCLUSIVAMENTE nas 5 tabelas da 043
    grant select, insert, update, delete on table
      public.empresas,
      public.papeis,
      public.permissoes,
      public.papel_permissoes,
      public.empresa_usuarios
    to authenticated;

    -- Conceder permissões para service_role EXCLUSIVAMENTE nas 5 tabelas da 043
    grant all on table
      public.empresas,
      public.papeis,
      public.permissoes,
      public.papel_permissoes,
      public.empresa_usuarios
    to service_role;

    -- Revogar qualquer privilégio de anon nas 5 tabelas da fundação SaaS
    revoke all on table
      public.empresas,
      public.papeis,
      public.permissoes,
      public.papel_permissoes,
      public.empresa_usuarios
    from anon;
  end if;
end $$;

-- POLÍTICAS DE SEGURANÇA (RLS EXCLUSIVAS DAS 5 TABELAS DA 043)
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
    public.has_company_permission(id, 'gerenciar_empresa_atual')
  )
  with check (
    public.is_platform_superadmin() or
    public.has_company_permission(id, 'gerenciar_empresa_atual')
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
    (empresa_id is not null and public.has_company_permission(empresa_id, 'gerenciar_usuarios'))
  )
  with check (
    public.is_platform_superadmin() or
    (empresa_id is not null and public.has_company_permission(empresa_id, 'gerenciar_usuarios'))
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
        and public.has_company_permission(p.empresa_id, 'gerenciar_usuarios')
    )
  )
  with check (
    public.is_platform_superadmin() or
    exists (
      select 1 from public.papeis p
      where p.id = papel_id
        and p.empresa_id is not null
        and public.has_company_permission(p.empresa_id, 'gerenciar_usuarios')
    )
  );

-- EMPRESA_USUARIOS (Visibilidade e Escrita Estritas)
drop policy if exists empresa_usuarios_select_policy on public.empresa_usuarios;
create policy empresa_usuarios_select_policy on public.empresa_usuarios
  for select to authenticated
  using (
    public.is_platform_superadmin() or
    (public.has_company_permission(empresa_id, 'gerenciar_usuarios') and public.is_company_member(empresa_id)) or
    usuario_id = public.current_usuario_id()
  );

drop policy if exists empresa_usuarios_insert_policy on public.empresa_usuarios;
create policy empresa_usuarios_insert_policy on public.empresa_usuarios
  for insert to authenticated
  with check (
    public.is_platform_superadmin() or
    (public.has_company_permission(empresa_id, 'gerenciar_usuarios') and public.is_company_member(empresa_id))
  );

drop policy if exists empresa_usuarios_update_policy on public.empresa_usuarios;
create policy empresa_usuarios_update_policy on public.empresa_usuarios
  for update to authenticated
  using (
    public.is_platform_superadmin() or
    (public.has_company_permission(empresa_id, 'gerenciar_usuarios') and public.is_company_member(empresa_id))
  )
  with check (
    public.is_platform_superadmin() or
    (public.has_company_permission(empresa_id, 'gerenciar_usuarios') and public.is_company_member(empresa_id))
  );

drop policy if exists empresa_usuarios_delete_policy on public.empresa_usuarios;
create policy empresa_usuarios_delete_policy on public.empresa_usuarios
  for delete to authenticated
  using (
    public.is_platform_superadmin() or
    (public.has_company_permission(empresa_id, 'gerenciar_usuarios') and public.is_company_member(empresa_id))
  );

commit;
```

---

## 4. STATUS DECLARADO CONFORME DIRETRIZ

```text
RLS VALIDADA EM SIMULADOR
CORREÇÃO DE GRANTS CONCLUÍDA E ISOLADA
NÃO APTA PARA PRODUÇÃO ATÉ HOMOLOGAÇÃO SUPABASE REAL E AUTORIZAÇÃO EXPLÍCITA
```
