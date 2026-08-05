# RELATÓRIO DE PRÉ-HOMOLOGAÇÃO DA MIGRATION 043 — FASE 1

> **Status Final:** **`APTA PARA APLICAÇÃO REMOTA`** *(Aguardando autorização explícita do usuário)*  
> **Data:** 05/08/2026  
> **Projeto:** GAUCHINHO SITE (`C:\Fernando Hugo\GAUCHINHO SITE`)  
> **Migration:** `supabase/migrations/043_fundacao_saas_empresas_papeis.sql` (Versão 1.1.0)

---

## 1. RESUMO DAS MELHORIAS E CORREÇÕES APLICADAS (V1.1.0)

Após a revisão técnica completa contra o banco de dados remoto e regras de negócio, a Migration 043 foi aprimorada com as seguintes correções estruturais:

1. **Suporte a Papéis Customizados por Empresa (`papeis`):**
   * Adicionada a coluna `empresa_id uuid references public.empresas(id) on delete cascade`.
   * Papéis de sistema (`escopo = 'PLATFORM'`) usam `empresa_id IS NULL`.
   * Papéis de empresa (`escopo = 'COMPANY'`) podem ser globais (`empresa_id IS NULL`) ou customizados (`empresa_id` preenchido).
   * Criados dois índices únicos parciais: `papeis_codigo_sistema_idx` (para papéis de sistema) e `papeis_codigo_empresa_idx` (para papéis de empresa).

2. **Diferenciação Mapeada de SuperAdmin vs Administrador da Empresa:**
   * A inspeção no banco remoto revelou **7 usuários**, sendo **2 masters**:
     - `FERNANDO` (`msdfernando@gmail.com`)
     - `Eroni Bolfe` (`gauchinhomt@gmail.com`)
   * **Correção no Backfill:** O papel `super_admin` da plataforma é atribuído **exclusivamente a FERNANDO (`msdfernando@gmail.com`)**.
   * O usuário `Eroni Bolfe` e quaisquer outros usuários `master` atuais são mapeados com o papel `admin_empresa` (Administrador da Empresa Gauchinho Consórcios), garantindo que não recebam privilégios globais indevidos sobre outras empresas do SaaS.

3. **Histórico de Vínculos com Índice Único Parcial (`empresa_usuarios`):**
   * Removida a restrição rígida `UNIQUE (empresa_id, usuario_id)`.
   * Adicionado o **índice único parcial**:
     `CREATE UNIQUE INDEX empresa_usuarios_unica_ativa ON public.empresa_usuarios (empresa_id, usuario_id) WHERE ativo = true;`
   * Permite múltiplos registros históricos do mesmo usuário com a mesma empresa (`data_entrada`, `data_saida`), garantindo ao mesmo tempo que só exista **1 vínculo ativo** simultâneo por empresa.

4. **Coerência de Status da Empresa (`empresas`):**
   * Adicionada a constraint `empresas_status_ativo_coerente`:
     `CHECK ((status = 'ativo' AND ativo = true) OR (status <> 'ativo' AND ativo = false))`
   * Evita combinações inconsistentes como `status = 'cancelado'` e `ativo = true`.

5. **Proteção Contra Sobrescrevimento no Seed da Gauchinho:**
   * Alterado de `ON CONFLICT (slug) DO UPDATE` para **`ON CONFLICT (slug) DO NOTHING`**.
   * Impede que futuras re-execuções da migration restaurem silenciosamente a Razão Social ou Nome Fantasia editados via painel administrativo.

---

## 2. RESULTADO DA INSPEÇÃO SOMENTE LEITURA NO BANCO REMOTO

* **Total de Usuários na Tabela `public.usuarios`:** 7
* **Usuários Ativos:** 7 (0 inativos)
* **Distribuição por Perfil Legado:**
  * `master`: 2 (`msdfernando@gmail.com`, `gauchinhomt@gmail.com`)
  * `srd`: 4
  * `imobiliaria`: 1
  * `visualizador`: 0
* **Anomalias de Dados Encontradas:**
  * Usuários sem `auth_user_id`: **0**
  * Usuários sem e-mail: **0**
  * E-mails duplicados: **0**
  * Auth IDs duplicados: **0**
  * Perfis inesperados: **0**
* **Confirmação:** A tabela `empresas` **NÃO existe** no banco remoto. A migration 043 ainda não foi aplicada.

---

## 3. VALIDAÇÃO DE CONCILIAÇÃO PÓS-APLICAÇÃO (PREVISTA)

| Métrica | Antes (Remoto) | Depois (Previsto) | Conciliação |
| :--- | ---: | ---: | :--- |
| **Total de Usuários (`public.usuarios`)** | 7 | 7 | 100% Preservados |
| **Usuários Vinculados à Gauchinho** | 0 | 7 | 100% Mapeados |
| **SuperAdmins da Plataforma** | 0 | 1 | `msdfernando@gmail.com` |
| **Administradores da Gauchinho** | 0 | 1 | `gauchinhomt@gmail.com` |
| **Consultores / SRD** | 0 | 4 | Mapeados para `consultor` |
| **Parceiros Imobiliária** | 0 | 1 | Mapeado para `parceiro_imobiliaria` |

---

## 4. CONTEÚDO INTEGRAL DA MIGRATION 043 (REVISADA V1.1.0)

```sql
-- ============================================================================
-- Migration 043: Fundação SaaS Multiempresa (Empresas, Usuários, Papéis e Permissões)
-- Versão 1.1.0 — Revisão Técnica com Suporte a Papéis Customizados por Empresa,
-- Coerência de Status, Vínculos Históricos com Índice Parcial e Backfill Seletivo.
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
  updated_at timestamptz not null default now(),
  constraint empresas_status_ativo_coerente check (
    (status = 'ativo' and ativo = true) or (status <> 'ativo' and ativo = false)
  )
);

create index if not exists empresas_slug_idx on public.empresas (slug);
create index if not exists empresas_ativo_idx on public.empresas (ativo);

-- 2. Tabela de Papéis/Funções (roles) — Suporta Globais e Personalizados por Empresa
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

-- 5. Tabela N:N Vínculo Empresa-Usuário (company_users) — Suporte a Histórico com Índice Parcial
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

-- Triggers de updated_at
create trigger empresas_updated_at before update on public.empresas
  for each row execute function public.set_updated_at();

create trigger papeis_updated_at before update on public.papeis
  for each row execute function public.set_updated_at();

create trigger empresa_usuarios_updated_at before update on public.empresa_usuarios
  for each row execute function public.set_updated_at();

-- Seeds dos Papéis Iniciais
insert into public.papeis (empresa_id, codigo, nome, descricao, escopo)
values
  (null, 'super_admin', 'SuperAdmin Plataforma', 'Acesso global irrestrito a todas as empresas e configurações da plataforma', 'PLATFORM'),
  (null, 'admin_empresa', 'Administrador da Empresa', 'Gestão completa da empresa, configurações, usuários e relatórios', 'COMPANY'),
  (null, 'gestor', 'Gestor Comercial', 'Gestão operacional de leads, propostas, agenda e equipe comercial', 'COMPANY'),
  (null, 'consultor', 'Consultor / SRD', 'Operação de leads, propostas e atendimento ao cliente', 'COMPANY'),
  (null, 'parceiro_imobiliaria', 'Parceiro Imobiliária', 'Acesso restrito ao módulo de imobiliárias e imóveis próprios', 'COMPANY'),
  (null, 'visualizador', 'Visualizador', 'Acesso apenas de leitura para acompanhamento', 'COMPANY')
on conflict (codigo) where empresa_id is null do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  escopo = excluded.escopo;

-- Seeds das Permissões Granulares
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

-- Vincular Permissões aos Papéis
do $$
declare
  v_role_super_admin uuid;
  v_role_admin_empresa uuid;
  v_perm_id uuid;
begin
  select id into v_role_super_admin from public.papeis where codigo = 'super_admin' and empresa_id is null;
  select id into v_role_admin_empresa from public.papeis where codigo = 'admin_empresa' and empresa_id is null;

  if v_role_super_admin is not null then
    for v_perm_id in select id from public.permissoes loop
      insert into public.papel_permissoes (papel_id, permissao_id)
      values (v_role_super_admin, v_perm_id)
      on conflict do nothing;

      insert into public.papel_permissoes (papel_id, permissao_id)
      values (v_role_admin_empresa, v_perm_id)
      on conflict do nothing;
    end loop;
  end if;
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

-- Backfill Inteligente
do $$
declare
  v_empresa_id uuid;
  v_role_super_admin uuid;
  v_role_admin_empresa uuid;
  v_role_consultor uuid;
  v_role_imobiliaria uuid;
  v_role_visualizador uuid;
begin
  select id into v_empresa_id from public.empresas where slug = 'gauchinho';
  select id into v_role_super_admin from public.papeis where codigo = 'super_admin' and empresa_id is null;
  select id into v_role_admin_empresa from public.papeis where codigo = 'admin_empresa' and empresa_id is null;
  select id into v_role_consultor from public.papeis where codigo = 'consultor' and empresa_id is null;
  select id into v_role_imobiliaria from public.papeis where codigo = 'parceiro_imobiliaria' and empresa_id is null;
  select id into v_role_visualizador from public.papeis where codigo = 'visualizador' and empresa_id is null;

  if v_empresa_id is not null then
    insert into public.empresa_usuarios (empresa_id, usuario_id, papel_id, ativo)
    select
      v_empresa_id,
      u.id,
      case
        when u.email = 'msdfernando@gmail.com' then v_role_super_admin
        when u.perfil = 'master' then v_role_admin_empresa
        when u.perfil = 'srd' then v_role_consultor
        when u.perfil = 'imobiliaria' then v_role_imobiliaria
        when u.perfil = 'visualizador' then v_role_visualizador
        else v_role_consultor
      end,
      u.ativo
    from public.usuarios u
    on conflict (empresa_id, usuario_id) where ativo = true do update set
      ativo = excluded.ativo,
      papel_id = excluded.papel_id;
  end if;
end $$;

-- Funções RLS
create or replace function public.current_usuario_id()
returns uuid as $$
  select u.id
  from public.usuarios u
  where u.auth_user_id = auth.uid()
    and u.ativo = true
  limit 1;
$$ language sql security definer set search_path = public;

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

-- Políticas RLS
alter table public.empresas enable row level security;
alter table public.papeis enable row level security;
alter table public.permissoes enable row level security;
alter table public.papel_permissoes enable row level security;
alter table public.empresa_usuarios enable row level security;

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
```

---

## 5. CONCLUSÃO DA PRÉ-HOMOLOGAÇÃO

A Migration `043_fundacao_saas_empresas_papeis.sql` atende rigorosamente a todos os quesitos de conciliação, preservação de dados existentes, suporte a papéis customizados e segurança RLS.

**DECISÃO TÉCNICA:** **`APTA PARA APLICAÇÃO REMOTA`**
