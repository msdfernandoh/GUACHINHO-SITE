# FASE 4 SaaS — Catálogo Global de Administradoras

**Título:** Catálogo Global de Administradoras  
**Fonte canônica:** `docs/SAAS-MASTER-ARCHITECTURE.md`  
**Branch:** `feature/saas-fase-4-catalogo-administradoras`  
**Base main:** `7eb7b4bb7c2bb4b69a9e13b66b92de2fc617e121`

| Marco | Hash / evidência |
|---|---|
| E0 remoto | `d6ec92792bc43d9e78e84de2858db457435f799c` |
| E1 código remoto | `0a1df2e5467ff410cc894c58aacb80c236bd0063` |
| E2 remoto | `5fb3b07a35f9c01e6686a85e00fb1df7d5192b75` |
| E3 remoto | `3ecd168f26ff6c55fc8ef39b4257e5ca563a6a52` |
| E4 remoto | `05803297631a5e58b34b88dac9fa22df814de20a` |
| E5 remoto | `6ddbd0ccea0a9dc59cce06b60d5142745b249de9` (push documental pós-homologação grupos vinculados) |
| E6 código | **local** (commits E6 abaixo — **NÃO pushed**) |
| Migration 049 | **CRIADA LOCALMENTE · NÃO APLICADA** |
| Migration 047 | **APLICADA** |
| Migration 048 | **APLICADA E HOMOLOGADA** (`048_fase4_backfill_grupos_administradora_id.sql`) |
| SHA256 048 | `FA9574A0E53066858B4EC99D519E203CB79E04F5F8FB00A975EA0F4B3301DABA` |
| Migrations sync | **001–048** local = remote |
| Dry-run pós | Remote database is up to date |

> **Estado da Fase 4:** EM ANDAMENTO.  
> **E0–E5:** CONCLUÍDAS (E5 remoto `6ddbd0c` · 048 aplicada/homologada).  
> **E6:** CONCLUÍDA EM CÓDIGO (local, **sem push** · migration **049 criada, NÃO aplicada**).  
> **E7+:** NÃO INICIADAS · **Fase 5:** NÃO INICIADA.

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
| **E2** | **CONCLUÍDA** (remoto `5fb3b07`) |
| **E3** | **CONCLUÍDA** (remoto `3ecd168`) |
| **E4** | **CONCLUÍDA** (remoto `0580329`) |
| **E5** | **APLICADA E HOMOLOGADA** (remoto `33b6b2d` · migration 048) |
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

### 12.7 Call sites
E3 CRUD global ← **remoto `3ecd168`** · E4 concessões ← **remoto `0580329`** · E5 backfill/adapters ← **remoto `33b6b2d` · 048 aplicada** · E6 grupos/APIs/RLS

### 12.8 Banco nesta E2
Nenhuma migration 048. **001–047** local=remote. Dry-run up to date.

### 12.9 Testes / build E2
* Novos testes administradoras: **29**
* Suite total: **516 passed** (98 files)
* `npm run build`: exit 0
* Push E2: `5fb3b07`

---

## 13. E3 — Administração global (PLATFORM_SUPERADMIN)

### 13.1 Escopo
UI + Server Actions para CRUD do **catálogo global** `administradoras`.  
**Não** gerencia `empresa_administradoras` (E4). Sem backfill, sem alteração de grupos/RLS/APIs públicas. Sem migration 048.

### 13.2 Rotas
* `/admin/administradoras` — listagem (busca + filtro status)
* `/admin/administradoras/nova` — criação
* `/admin/administradoras/[id]` — edição + status + empresas/franqueadas vinculadas (somente leitura informativa)

### 13.3 Menu
`SUPERADMIN_NAV`: **Catálogo de Administradoras** (somente `isPlatformSuperadmin`).  
Não aparece para admin_empresa/gestor/consultor/parceiro/visualizador.

### 13.4 Mutations (service)
* `createAdministradoraGlobal`
* `updateAdministradoraGlobal`
* `setAdministradoraGlobalStatus`
* Reutiliza `listAdministradorasGlobaisForSuperadmin` + `requireGerenciarCatalogoAdministradoras`

### 13.5 Segurança
* Gate de página + revalidação em toda Server Action
* Escritas via sessão/`createClient` (RLS Superadmin)
* Contagem/lista de vínculos usa service role **após** assert Superadmin
* Sem endpoint público; sem DELETE físico
* JSON de integração rejeita chaves de secret/token/password

### 13.6 Auditoria (`audit_logs`)
* `ADMINISTRADORA_GLOBAL_CRIADA`
* `ADMINISTRADORA_GLOBAL_ATUALIZADA`
* `ADMINISTRADORA_GLOBAL_STATUS_ALTERADO`
* Inclui `administradora_id`, campos alterados, antes/depois

### 13.7 Slug / CNPJ
* Slug normalizado + unique global; edição de slug permitida e **auditada** (impacto futuro em URLs documentado na UI)
* CNPJ opcional, normalizado + validação checksum; unique parcial

### 13.8 Racon / Gauchinho / Empresa B
* Racon aparece como administradora global única seedada
* Gauchinho aparece apenas como **empresa/franqueada vinculada** no detalhe da Racon
* Empresa B continua com **0** concessões; E3 não cria vínculos

### 13.9 Testes / build E3
* Suite: **533 passed** (100 files)
* Sem migration 048; **001–047** sync; dry-run up to date
* Push E3: `3ecd168` (local = remote)

---

## 14. E4 — Concessões Empresa/Franquia × Administradora

### 14.1 Escopo
Gestão exclusiva pelo `PLATFORM_SUPERADMIN` das concessões `empresa_administradoras` no detalhe da empresa:

`/admin/empresas/[id]` → seção **Administradoras autorizadas**

**Não** é catálogo global (continua em `/admin/administradoras`).  
Sem migration 048 · sem backfill · sem alteração de grupos/cotas/RLS pública · sem APIs públicas · sem E5 · sem deploy.

### 14.2 Princípio de confidencialidade
* COMPANY_ADMIN / gestor / consultor / parceiro: sem acesso à seção, sem listagem global candidata, sem mutations de concessão.
* Sem endpoint tenant `/api/administradoras-disponiveis`.
* Mensagens uniformes de negação — sem revelar existência de administradoras não autorizadas.

### 14.3 Serviços (`lib/administradoras/concessoes.ts`)
* `getEmpresaAdministradorasForSuperadmin`
* `listAdministradorasCandidatasParaEmpresa` (globais ATIVAS ainda não vinculadas)
* `grantAdministradoraToEmpresa` (status inicial ATIVA; exige global ATIVA)
* `updateEmpresaAdministradora` (codigo_franquia, codigo_comercial, contato_interno, observacoes)
* `setEmpresaAdministradoraStatus` (ATIVA / INATIVA / SUSPENSA; sem DELETE)
* Server Actions: `admin/empresas/administradoras-actions.ts` com `requireGerenciarAdministradorasEmpresa`

### 14.4 Regras
* Unique `(empresa_id, administradora_id)` → mensagem amigável
* Global INATIVA: bloqueia nova concessão e reativação operacional do vínculo
* `configuracoes` JSONB **não** exposto na UI E4
* Sem secrets (API key/token/password/webhook)

### 14.5 Auditoria (`audit_logs`)
* `EMPRESA_ADMINISTRADORA_CONCEDIDA`
* `EMPRESA_ADMINISTRADORA_ATUALIZADA`
* `EMPRESA_ADMINISTRADORA_STATUS_ALTERADO`

### 14.6 Estado dos tenants nesta rodada
* Gauchinho → Racon → ATIVA (carregado; não recriado; não alterado automaticamente)
* Empresa B → **0** concessões (`em_treinamento`); UI pronta; sem grant real nesta E4

### 14.7 Efeito runtime
E4 gerencia apenas a concessão estrutural. Grupos/simulador/APIs públicas ainda **não** filtram por concessão (E5/E6). UI alerta isso sem prometer efeito inexistente.

### 14.8 Testes / build E4
* Cobertura auth (Superadmin PASS; demais DENY), confidencialidade, Gauchinho/Racon, Empresa B vazia, duplicate, global INATIVA, status ATIVA↔SUSPENSA/INATIVA (mocks)
* Suite: **551 passed** (102 files)
* `npm run build`: exit 0
* Push E4: `0580329` (local = remote)

---

## 15. E5 — Backfill grupos + adapters de transição

### 15.1 Escopo
Transição estrutural `grupos_consorcio.administradora` (TEXT) → `administradora_id` (UUID/FK), **sem** remover texto legado, **sem** alterar RLS pública, **sem** filtrar APIs/simulador (E6).

### 15.2 Pré-auditoria remota (READ-ONLY)
| Item | Resultado |
|---|---|
| Total grupos | **19** |
| Texto | RACON ×16 · Racon ×3 |
| `administradora_id` preenchidos | **0** |
| Texto desconhecido / sem texto | **0** |
| `grupos_cotas` | **178** |
| Refs `contratacoes_online.grupo_id` | 18 |
| Refs `simulacoes_grupos` | 10 |
| Refs `grupos_modalidades_lance` | 31 |
| Racon global | 1 × `c5f8ecb4-…` slug=`racon` status=`ATIVA` |
| Gauchinho→Racon | ATIVA |
| Empresa B concessões | **0** |

### 15.3 Migration
* Arquivo: `supabase/migrations/048_fase4_backfill_grupos_administradora_id.sql`
* SHA256: `FA9574A0E53066858B4EC99D519E203CB79E04F5F8FB00A975EA0F4B3301DABA`
* Backfill: `administradora_id = Racon` onde `lower(trim(administradora)) = 'racon'`
* Texto legado **intocado** (não normaliza RACON→Racon)
* Asserts pré/pós (19 grupos, 16/3 texto, 178 cotas, Racon única)
* Coluna permanece **nullable** (sem NOT NULL)
* Apply: `supabase db push --linked --yes` (somente 048) — **APLICADA**

### 15.4 Adapters
* `resolveGrupoAdministradora` — UUID estrutural; texto = snapshot/fallback legado
* `getGrupoWithAdministradora` / `listGruposWithAdministradora`
* `buildGrupoAdministradoraDualWrite` + `resolveGrupoAdministradoraDualWriteFromForm`
* Dual-write em `/admin/grupos` (create/update/popular teste): UUID + snapshot; staff master/srd; sem marketplace tenant
* Service role só para lookup pontual de administradora **após** `assertCanManageGrupos`
* Texto arbitrário rejeitado; alias legado Racon resolvido para UUID canônico
* Global INATIVA: dual-write rejeita (teste unitário/mock — Racon real não inativada)

### 15.5 Homologação pós-apply (contagens)

| Entidade | Pré | Pós |
|---|---:|---:|
| administradoras Racon (`slug=racon`) | 1 | 1 |
| Gauchinho→Racon ATIVA | 1 | 1 |
| Empresa B concessões | 0 | 0 |
| grupos_consorcio | 19 | 19 |
| grupos com `administradora_id` Racon | 0 | **19** |
| texto RACON | 16 | 16 |
| texto Racon | 3 | 3 |
| grupos_cotas | 178 | 178 |
| propostas | 16 | 16 |
| contratacoes_online (via grupo_id) | 18 | 18 |
| simulacoes_grupos | 10 | 10 |
| grupos_modalidades_lance | 31 | 31 |

Única mudança da 048: `administradora_id` 0→19.  
`grupos_cotas` sem coluna `administradora_id` (herda via `grupo_id`).  
Snapshots propostas/contratações intactos.

### 15.6 RLS / regressão
* 048 **não** contém `POLICY`/`RLS` — `grupos_public_read`, `cotas_public_read`, `grupos_modalidades_lance_select_public` intactas
* HTTP prod: `/grupos` 200 · `/simulador` 200 · `/admin/grupos` 307 (login) · `/api/public/grupos/fluxo` GET 405 / POST `{}` 400 · `/api/integration/grupos` 503 sem API key (esperado)
* E6 **não** iniciada

### 15.7 Testes / build / git E5
* Suite: **562 passed** (103 files)
* `npm run build`: exit 0
* CLI: `%LOCALAPPDATA%\supabase-cli\supabase.exe` **2.111.0**
* Push E5: `33b6b2d` (local = remote)
* Pós-apply: **001–048** sync · dry-run **up to date**

---

## 16. E6 — Confidencialidade do catálogo comercial (concessão empresa × administradora)

**Objetivo:** runtime e APIs públicas leem grupos/cotas/modalidades **somente** via concessão ATIVA + administradora global ATIVA, resolvendo **empresa pelo Host** (Fase 2/3), sem `?empresa_id=` / header arbitrário como autoridade.

### 16.1 Push documental E5
* Branch: `feature/saas-fase-4-catalogo-administradoras`
* `git push origin feature/saas-fase-4-catalogo-administradoras` → **Everything up-to-date**
* **local = remote = `6ddbd0c`**

### 16.2 Service layer tenant-scoped (server-only + service role)
* `gauchinho-app/src/lib/grupos/catalogo-autorizado.ts` — regras puras, erros uniformes `NOT_FOUND`, `resolveEmpresaIdForCatalog`, `parseSelecoesGrupoFromDadosSimulacao`
* `gauchinho-app/src/lib/grupos/catalogo-autorizado-service.ts` — `listGruposAutorizadosForEmpresa`, `getGrupoAutorizadoForEmpresa`, `listCotasAutorizadasForEmpresa`, `listModalidadesAutorizadasForEmpresa`, `fetchPublicGruposAggregatesForEmpresa`, `assertSelecoesAutorizadasForEmpresa`, `assertDadosSimulacaoGruposAutorizadosForEmpresa`
* `gauchinho-app/src/lib/grupos/resolve-catalog-empresa.ts` — Host/proxy → `empresa_id`; parceiro Fase 3 → empresa franqueada; **ignora** `x-tenant-*` do Request como autoridade

### 16.3 Call sites migrados
| Superfície | Comportamento |
|---|---|
| `/grupos` | `fetchPublicGruposAggregates()` → tenant-scoped; sorteios usam `listGruposAutorizadosForEmpresa` |
| Home (`load-home-data`) | Herda `fetchPublicGruposAggregates` tenant-scoped |
| `/api/public/grupos/fluxo` | `getCatalogEmpresaIdFromRequest` + `assertSelecoesAutorizadasForEmpresa` |
| `/api/integration/grupos` (+ `[id]`) | API key → **Gauchinho** (`resolveIntegrationEmpresa`); lista/detalhe filtrados por concessão |
| Contratações | `iniciar` (SDR+grupos) e `rascunho/materializar` validam `assertDadosSimulacaoGruposAutorizadosForEmpresa` |
| `/admin/grupos` | Staff continua listagem global via sessão/RLS staff (não reutiliza filtro público) |
| `/simulador` | Simulador genérico (índices/config); catálogo real de grupos permanece em `/grupos` + APIs acima |

### 16.4 Empresa B vs Gauchinho (testes)
* **Empresa B** (`0 concessões`): listas `[]`; UUID grupo/cota Racon → mesma mensagem `Grupo não encontrado.` / cota equivalente; sem vazamento de metadata
* **Gauchinho** (Racon ATIVA): mesma regra de elegibilidade (`ativo`, status); catálogo Racon via `administradora_id`
* **Concessão SUSPENSA/INATIVA** e **admin global INATIVA**: testes unitários mock (sem alterar dados reais)

### 16.5 Integração API key
* Lacuna estrutural documentada: única key `GAUCHINHO_INTEGRATION_API_KEY` → `GAUCHINHO_EMPRESA_ID`; multi-tenant de keys = migration futura
* Não lista catálogo global sem empresa vinculada

### 16.6 Cartas contempladas
* `cartas_contempladas.administradora` permanece **texto**; sem FK estrutural nesta E6
* **Risco documentado:** filtro por concessão exige migration futura (`administradora_id` ou tenant-scoped rows); não bloqueia E6

### 16.7 Cache
* Sem cache global de catálogo; `fetchPublicGruposAggregatesForEmpresa` documenta chave futura com `empresaId`
* Integration routes: `Cache-Control: private, no-store`

### 16.8 RLS — estado vs proposta (049)
**Ainda ativas em produção (até apply 049):**
* `grupos_public_read`, `cotas_public_read`, `grupos_modalidades_lance_select_public`

**Migration 049 (local, NÃO aplicada):** remove as três policies acima; runtime já não depende delas para `/grupos` e fluxos migrados.

**Ordem de apply recomendada:** deploy app E6 → homologar Gauchinho → então `supabase db push` só 049.

### 16.9 Testes / build
* `npm test`: **581 passed** (104 files)
* `npm run build`: exit 0
* Migrations: **001–048** sync remoto; **049** somente local

### 16.10 Git E6 (local — aguardar autorização para push)
* Commits sugeridos: feat catálogo por concessão · docs E6 · (049 no commit feat ou separado)
* **E7 não iniciada · deploy produção não executado · 049 não aplicada**
