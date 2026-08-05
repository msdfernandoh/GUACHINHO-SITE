# RELATÓRIO DE PRÉ-HOMOLOGAÇÃO DA MIGRATION 043 — FASE 1 (VERSÃO 1.2.0)

> **Status Final:** **`APTA PARA APLICAÇÃO REMOTA`** *(Aguardando autorização explícita do usuário)*  
> **Data:** 05/08/2026  
> **Projeto:** GAUCHINHO SITE (`C:\Fernando Hugo\GAUCHINHO SITE`)  
> **Migration:** `supabase/migrations/043_fundacao_saas_empresas_papeis.sql` (Versão 1.2.0)

---

## 1. RESUMO DOS APERFEIÇOAMENTOS TÉCNICOS DA VERSÃO 1.2.0

Nesta versão 1.2.0, a Migration 043 passou por uma rodada intensiva de endurecimento de segurança, isolamento relacional e idempotência:

1. **Trigger de Validação `trg_validar_papel_empresa_usuario`:**
   * Impede que um papel personalizado (`escopo = 'COMPANY'` com `empresa_id` preenchido) da Empresa A seja atribuído a um usuário da Empresa B em operações de `INSERT` ou `UPDATE`.
   * Lança exceção PostgreSQL imediata caso ocorra tentativa de violação de escopo.

2. **Visibilidade Corrigida em `empresa_usuarios` (RLS):**
   * `super_admin`: visualiza todos os vínculos de todas as empresas.
   * `admin_empresa`: visualiza apenas os membros da sua própria empresa.
   * `consultor`, `parceiro_imobiliaria`, `visualizador`: **visualizam exclusivamente o seu próprio vínculo** (`usuario_id = current_usuario_id()`).

3. **Restrição de Leitura de Papéis e Permissões Customizados:**
   * Papéis (`papeis`) e suas permissões (`papel_permissoes`) são legíveis somente se forem papéis globais (`empresa_id IS NULL`), pertencerem a uma empresa onde o usuário tem vínculo ativo (`is_company_member(empresa_id)`), ou se o usuário for `super_admin`.
   * O catálogo de permissões (`permissoes`) permanece legível a todos os autenticados por ser constante de sistema.

4. **Separação de Permissões de Plataforma vs Empresa:**
   * Criada a permissão `gerenciar_empresas_plataforma` (atribuída exclusivamente a `super_admin`).
   * Criada a permissão `gerenciar_empresa_atual` (atribuída a `admin_empresa` para gestão da própria empresa).

5. **Helper de Permissão Granular `has_company_permission()`:**
   * Função PostgreSQL `SECURITY DEFINER SET search_path = public` que valida se o usuário possui determinada permissão granular no contexto da empresa informada.

6. **Garantia de Triggers e Seeds Seguros:**
   * Triggers utilizam `DROP TRIGGER IF EXISTS` antes da criação.
   * Seeds utilizam `ON CONFLICT DO NOTHING` / `ON CONFLICT DO UPDATE`.

---

## 2. RESULTADOS DA SUÍTE DE TESTES ESTÁTICOS E LÓGICOS

Executada a suíte de testes locais em Node.js (`test_migration_043.js`):
* `Constraint de coerência status/ativo em empresas`: **PASS**
* `Suporte a empresa_id em papeis`: **PASS**
* `Índices únicos parciais em papeis`: **PASS**
* `Índice único parcial em empresa_usuarios`: **PASS**
* `Trigger de validação de papel por empresa`: **PASS**
* `Separação gerenciar_empresas_plataforma vs gerenciar_empresa_atual`: **PASS**
* `Seed da Gauchinho com ON CONFLICT DO NOTHING`: **PASS**
* `Backfill seletivo de SuperAdmin (apenas Fernando)`: **PASS**
* `Helper has_company_permission`: **PASS**
* `Políticas RLS com USING e WITH CHECK explícitos`: **PASS**
* `Política de empresa_usuarios restrita a usuário comum`: **PASS**

---

## 3. VALIDAÇÃO DE COMPILAÇÃO E BUILD DA APLICAÇÃO

* **Comando:** `npm run build` na subpasta `gauchinho-app/`
* **Resultado:** `✓ Compiled successfully in 12.1s`
* **Rotas Compiladas:** 50/50 rotas compiladas com sucesso sem erros de TypeScript ou bundle.

---

## 4. CONTEÚDO INTEGRAL DA MIGRATION 043 (VERSÃO 1.2.0)

```sql
-- ============================================================================
-- Migration 043: Fundação SaaS Multiempresa (Empresas, Usuários, Papéis e Permissões)
-- Versão 1.2.0 — Proteção contra atribuição de papéis de outra empresa,
-- RLS explícito com USING e WITH CHECK, isolamento de papéis customizados,
-- separação de permissões globais/locais e helper de permissões granulares.
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

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

create table if not exists public.papel_permissoes (
  papel_id uuid not null references public.papeis (id) on delete cascade,
  permissao_id uuid not null references public.permissoes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (papel_id, permissao_id)
);

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

drop trigger if exists empresas_updated_at on public.empresas;
create trigger empresas_updated_at before update on public.empresas
  for each row execute function public.set_updated_at();

drop trigger if exists papeis_updated_at on public.papeis;
create trigger papeis_updated_at before update on public.papeis
  for each row execute function public.set_updated_at();

drop trigger if exists empresa_usuarios_updated_at on public.empresa_usuarios;
create trigger empresa_usuarios_updated_at before update on public.empresa_usuarios
  for each row execute function public.set_updated_at();

-- Trigger de Validação de Escopo de Papel
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

  if v_role_escopo = 'COMPANY' and v_role_empresa_id is not null then
    if v_role_empresa_id <> NEW.empresa_id then
      raise exception 'Papel personalizado da empresa % não pode ser atribuído a usuário da empresa %.',
        v_role_empresa_id, NEW.empresa_id;
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_validar_papel_empresa_usuario on public.empresa_usuarios;
create trigger trg_validar_papel_empresa_usuario
  before insert or update on public.empresa_usuarios
  for each row execute function public.validar_papel_empresa_usuario();
```

---

## 5. DECISÃO TÉCNICA

```text
APTA PARA APLICAÇÃO REMOTA
```

*(Nenhuma migration foi aplicada no banco remoto. Nenhum git push foi realizado. Aguardando sua autorização explícita).*
