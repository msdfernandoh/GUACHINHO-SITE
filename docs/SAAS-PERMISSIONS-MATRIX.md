# MATRIZ DE PERMISSÕES E CAPABILITIES SAAS MULTIEMPRESA

> **Versão:** 1.0.0  
> **Aplica-se a:** Controle de Acesso Baseado em Papéis (RBAC) e Isolamento Multi-tenant  
> **Tabelas de Controle:** `public.papeis`, `public.permissoes`, `public.papel_permissoes`, `public.empresa_usuarios`

---

## 1. Visão Geral da Matriz de Acesso

O sistema de permissões opera em duas camadas obrigatórias:
1. **Camada de Tenant (`empresa_id`):** RLS PostgreSQL garante que o usuário veja **somente** dados vinculados aos tenants autorizados em `empresa_usuarios`.
2. **Camada de Papel/Capability (`papel_id`):** Define as ações específicas que o usuário pode executar dentro do tenant.

---

## 2. Matriz Canônica de Perfis e Capabilities

| Perfil / Papel | Escopo | Ler Catálogo / Leads / Propostas | Criar / Editar Vendas & Contratações | Operar Financeiro & Caixa | Gerenciar Equipes & Metas | Ver Auditoria Central | Conceder Administradoras Globais |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **`PLATFORM_SUPERADMIN`** | Global (Todos os Tenants) | YES | YES | YES | YES | YES | **EXCLUSIVO** |
| **`TENANT_ADMIN` (Master)** | Próprio Tenant | YES | YES | YES | YES | YES | NO |
| **`FINANCEIRO`** | Próprio Tenant | YES | NO | **YES** | NO | YES | NO |
| **`GESTOR_COMERCIAL`** | Próprio Tenant | YES | YES | NO | **YES** | YES | NO |
| **`CONSULTOR / VENDEDOR`** | Somente Próprios Dados | **PRÓPRIOS** | **PRÓPRIOS** | NO | NO | NO | NO |
| **`PARCEIRO COMMERCIAL`** | Somente Própria Organização | **PRÓPRIOS** | **PRÓPRIOS** | NO | NO | NO | NO |
| **`USUÁRIO SEM CAPABILITY`** | Próprio Tenant | NO | NO | NO | NO | NO | NO |
| **`ANÔNIMO / PUBLIC`** | Público Geral | APENAS GRUPOS ELEGÍVEIS | APENAS SIMULAR / CAPTURAR LEAD | NO | NO | NO | NO |

---

## 3. Regras Específicas de Proteção

- **Financeiro & Caixa:** Exige permissão explícita `financeiro.operar` ou papel `TENANT_ADMIN`. Consultores e parceiros são terminantemente bloqueados de ver saldos globais de caixa ou repasses de terceiros.
- **Auditoria Central:** Exige permissão `auditoria.visualizar` e filtra automaticamente os logs por `empresa_id`.
- **Serviços Backend (`createAdminClient()`):** O uso da `service role` é permitido **exclusivamente** após a validação do token JWT e verificação explícita do `empresa_id` do usuário logado.
