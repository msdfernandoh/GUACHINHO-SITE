# FASE 4 SaaS — Catálogo Global de Administradoras

**Título:** Catálogo Global de Administradoras  
**Fonte canônica:** `docs/SAAS-MASTER-ARCHITECTURE.md`  
**Branch:** `feature/saas-fase-4-catalogo-administradoras`  
**Base main:** `7eb7b4bb7c2bb4b69a9e13b66b92de2fc617e121`

| Marco | Hash / evidência |
|---|---|
| E0 remoto | `d6ec92792bc43d9e78e84de2858db457435f799c` |
| E1 código remoto | `0a1df2e5467ff410cc894c58aacb80c236bd0063` |
| Migration 047 | **APLICADA** no Supabase remoto |
| Migrations | **001–047** local = remote |
| Dry-run | Remote database is up to date |

> **Estado da Fase 4:** EM ANDAMENTO.  
> **E0:** CONCLUÍDA · **E1:** APLICADA E HOMOLOGADA · **E2:** IMPLEMENTADA (commits locais; sem push).  
> **E3+:** NÃO INICIADAS · **Fase 5:** NÃO INICIADA.

---

## 0. Glossário terminológico (obrigatório)

| Termo | Significado neste projeto |
|---|---|
| **Administradora** | Entidade **global** da plataforma (ex.: **Racon**). Não é tenant. |
| **Empresa / franqueada / tenant** | Empresa SaaS credenciada (ex.: **Gauchinho Consórcios**, **Empresa B**). |
| **`empresa_administradoras`** | Concessão feita pelo `PLATFORM_SUPERADMIN`: empresa × administradora. |
| **Gauchinho → Racon → ATIVA** | A empresa/franqueada Gauchinho está **autorizada** a operar a administradora Racon. **Não** torna Gauchinho uma administradora. |
| **Parceiros / consultores / sites / leads / propostas** | Pertencem à **empresa/franqueada** (tenant), nunca à administradora global. |

**Proibido** em docs/código/UI/testes: tratar Gauchinho como administradora; Racon como tenant; parceiro como administradora.

---

## 1. Objetivo

Fundar o **catálogo global de administradoras** (ex.: Racon), com concessão exclusiva pelo `PLATFORM_SUPERADMIN` via `empresa × administradora`, preservando o legado operacional da franqueada Gauchinho e a confidencialidade comercial entre tenants.

---

## 2. Decisões de negócio

| # | Decisão |
|---|---|
| D1 | Administradora é entidade **GLOBAL** (não é empresa/franqueada) |
| D2 | Tenant **não escolhe** administradoras; não há marketplace |
| D3 | Concessão só por `PLATFORM_SUPERADMIN` |
| D4 | Tenant só vê administradoras **vinculadas e ativas** à própria empresa |
| D5 | Comissões/repasses **não** ficam no catálogo global |
| D6 | Fase 3 (parceiros no tenant) permanece intacta |
| D7 | Empresa B permanece `em_treinamento` sem concessão na E1 |
| D8 | Relacionamentos estruturais futuros por **UUID/FK**, não por texto |

---

## 3. Confidencialidade

Uma empresa sem autorização para determinada administradora **não pode**:

- listar, pesquisar, resolver por UUID/slug;
- obter logo/nome/modalidades/grupos/metadata;
- inferir existência via erro diferenciado;
- consumir API que exponha o catálogo global.

`PLATFORM_SUPERADMIN` vê o catálogo completo.  
Não basta esconder no frontend — RLS + helpers + APIs.

---

## 4. Achados E0 (histórico — estado pré-047)

Na auditoria E0 (antes da migration 047):

- **Não existiam** as tabelas `administradoras` / `empresa_administradoras`.
- Administradora aparecia só como **texto** em `grupos_consorcio`, `cartas_contempladas`, `contratacoes_online`.
- Valores texto: `RACON` (16 grupos) e `Racon` (3) — mesma marca, casing inconsistente.
- Contagens: 19 grupos, 178 `grupos_cotas` (opções comerciais), 16 propostas, 18 contratações, 2 empresas.
- Grupos sem `empresa_id` (catálogo global na prática); RLS pública lia todos os grupos ativos.
- Permissões de catálogo ainda não existiam (criadas na 047).

> Após a E1, as tabelas e a concessão Gauchinho×Racon **existem**. O texto legado e o backfill pendente permanecem (E5).

---

## 5. RLS de grupos (ainda legado — risco E6)

| Tabela | Exposição atual |
|---|---|
| `grupos_consorcio` | `grupos_public_read` — catálogo público global |
| `grupos_cotas` | `cotas_public_read` — público |
| `grupos_modalidades_lance` | select público |

A E1 **não** alterou essas policies. Redesign = **E6**.

---

## 6. Modelo canônico (realizado na 047)

### 6.1 `administradoras` (global)

Catálogo único da plataforma. Soft status `ATIVA` \| `INATIVA`.  
RLS E1: SELECT/INSERT/UPDATE só Superadmin; sem DELETE físico operacional.

### 6.2 `empresa_administradoras` (concessão)

Autorização Superadmin empresa×administradora. Soft status `ATIVA` \| `INATIVA` \| `SUSPENSA`.  
Unique `(empresa_id, administradora_id)`. FKs `ON DELETE RESTRICT`.  
RLS E1: SELECT/INSERT/UPDATE só Superadmin (tenant sem SELECT direto).

### 6.3 `grupos_consorcio.administradora_id`

Coluna **nullable** aditiva; texto `administradora` mantido; **sem backfill** na E1.

### 6.4 Desativação em dois níveis

| Nível | Efeito |
|---|---|
| Administradora global `INATIVA` | Nenhum tenant gera **novos** negócios com ela |
| Vínculo `INATIVA`/`SUSPENSA` | Afeta só aquela empresa/franqueada |

---

## 7. Relacionamento com grupos

**Opção A (adotada):** grupos globais da administradora + disponibilidade por concessão da empresa.  
Opção B (grupos por franquia) descartada nesta fase (alto risco de duplicação).

---

## 8. Plano de etapas

| Etapa | Status |
|---|---|
| **E0** | **CONCLUÍDA** |
| **E1** | **APLICADA E HOMOLOGADA** |
| **E2** | **IMPLEMENTADA** (local; sem push) |
| **E3** | **NÃO INICIADA** |
| **E4** | **NÃO INICIADA** |
| **E5** | **NÃO INICIADA** |
| **E6** | **NÃO INICIADA** |
| **E7** | **NÃO INICIADA** |
| **E8** | **NÃO INICIADA** |
| **E9** | **NÃO INICIADA** |

**Fase 4:** EM ANDAMENTO · **Fase 5:** NÃO INICIADA

---

## 9. E1 — Fundação estrutural (canônico)

### 9.1 Migration
* Arquivo: `supabase/migrations/047_fase4_catalogo_global_administradoras.sql`
* SHA256: `BC6C39DB751CB235005AAE7BB32A1AFA5DABB2DCB1F9E2E0689DB3BECCBB078B`
* Apply: `supabase db push --linked --yes` (somente 047)
* Pós: **001–047** sync; dry-run **up to date**

### 9.2 Seed Racon (administradora global)
* UUID: `c5f8ecb4-cb5a-5014-b567-50484719b404`
* `slug=racon`, `status=ATIVA`, nome canônico `Racon`
* Sem CNPJ/razão/site inventados

### 9.3 Concessão Gauchinho (empresa/franqueada)
* Empresa: `slug=gauchinho` → `7170f38e-15dd-4b19-8588-51e9a9cf0d4c`
* Vínculo: Gauchinho × Racon × **ATIVA** (exatamente 1)
* Empresa B (`8e4e13f9-80e6-44db-a21b-584a43b6f024`, `em_treinamento`): **0** concessões

### 9.4 Grupos / cotas pós-apply
* 19 grupos; `administradora_id` nullable; **0** preenchidos
* Texto intacto: RACON×16, Racon×3
* 178 `grupos_cotas`; 16 propostas; 18 contratações

### 9.5 Permissões
Somente `super_admin`:
* `gerenciar_catalogo_administradoras`
* `gerenciar_administradoras_empresa`

### 9.6 Helpers SQL da 047
* Reusa `is_platform_superadmin()` (043)
* Normalizadores (não SECURITY DEFINER de auth): `normalize_administradora_slug`, `normalize_cnpj_digits`
* Triggers before-write + `set_updated_at`
* Auditoria app via `audit_logs` existente (sem sistema paralelo)

### 9.7 Homologação E1
* Constraints + RLS: **21/21 PASS** (ROLLBACK)
* Smoke: `/grupos` + `/simulador` HTTP 200
* `npm test` 487 passed · `build` exit 0

### 9.8 Explicitamente fora da E1
Backfill · alteração RLS grupos/cotas · APIs/simulador · UI · E2/E3 · Fase 5 · concessão Empresa B · secrets

---

## 10. Riscos atuais (pós-E1)

| Risco | Severidade | Tratamento |
|---|---|---|
| RLS pública de grupos/cotas ainda aberta | **ALTA** | E6 |
| Confidencialidade multi-tenant do catálogo de grupos incompleta | **ALTA** | E6 |
| Runtime ainda não usa `administradora_id` nos grupos | **MÉDIA** | E5/E6 |
| Tenant sem SELECT direto em `empresa_administradoras` | **BAIXA/DESEJADA** | E2 (acesso autorizado sem abrir catálogo global) |

Removidos (já resolvidos): “047 não aplicada”, “runtime remoto da 047 não homologado”.

---

## 11. Call sites futuros (mapa)

| Etapa | Call sites |
|---|---|
| **E3** | CRUD global Superadmin (`administradoras`) |
| **E4** | Concessões em `/admin/empresas/[id]` |
| **E5** | `grupos_consorcio.administradora_id` backfill + adapters dual-read |
| **E6** | `/grupos`, simulador, `/api/public/grupos/fluxo`, `/api/integration/grupos`, RLS pública |

E2 **não** altera esses call sites.

---

## 12. E2 — Libs / helpers de autorização

### 12.1 Escopo
Camada de aplicação: **empresa/franqueada → concessão → administradora global**.  
Sem migration, sem backfill, sem alteração de RLS/APIs/UI de grupos.

### 12.2 Arquivos (`gauchinho-app/src/lib/administradoras/`)
| Arquivo | Função |
|---|---|
| `types.ts` | Tipos Administradora / EmpresaAdministradora / Autorizada |
| `constants.ts` | Permissões, status, UUIDs Racon/Gauchinho/Empresa B, audit actions |
| `errors.ts` | `AdministradoraNotFoundError` (`code: NOT_FOUND`) |
| `rules.ts` | Regras puras (status, filtro, slug, matriz papéis) |
| `authorization.ts` | Guards Superadmin + `assertCallerCanAccessEmpresa` |
| `repository.ts` | Fetch global (sessão) / concessões (service role pós-auth) |
| `service.ts` | API pública das funções E2 |
| `audit.ts` | Helper `writeAdministradorasAuditLog` → `audit_logs` |
| `index.ts` | Barrel server-only |
| `*.test.ts` | Testes unitários |

### 12.3 Funções
| Função | Escopo |
|---|---|
| `listAdministradorasGlobaisForSuperadmin` | GLOBAL / Superadmin |
| `listAdministradorasAutorizadasForEmpresa(empresaId)` | AUTORIZADO / tenant |
| `getAdministradoraAutorizadaById` | AUTORIZADO |
| `getAdministradoraAutorizadaBySlug` | AUTORIZADO |
| `assertEmpresaPodeUsarAdministradora` | AUTORIZADO |
| `assertAdministradoraGlobalAtiva` | GLOBAL / Superadmin |

### 12.4 Segurança
* Catálogo global: só `isPlatformSuperadmin()` — `admin_empresa`/consultor/parceiro negados.
* Tenant: `assertCallerCanAccessEmpresa` via sessão (`getUserCompanies`); **não** confia em query/body.
* Listagem autorizada exige **global ATIVA + vínculo ATIVA**.
* UUID/slug sem autorização → `NOT_FOUND` uniforme (sem revelar existência).
* Service role só em repository de concessões, **após** assert de sessão; nunca no client.
* Sem cache nesta E2.

### 12.5 Permissions
* `gerenciar_catalogo_administradoras` / `gerenciar_administradoras_empresa` — só Superadmin (espelha 047).

### 12.6 Resultados esperados
* Gauchinho → `[Racon]`
* Empresa B → `[]`; UUID/slug Racon → `NOT_FOUND`

### 12.7 Call sites futuros (ainda não alterados)
E3 CRUD global · E4 concessões UI · E5 backfill/adapters · E6 grupos/APIs/RLS

### 12.8 Banco nesta E2
Nenhuma migration 048. **001–047** local=remote. Dry-run up to date.

### 12.9 Testes / build E2
* Novos testes administradoras: **29**
* Suite total: **516 passed** (98 files)
* `npm run build`: exit 0
* Docs E1 corrigidas e pushadas: `b2ed7f6` (glossário terminológico + estado canônico)
