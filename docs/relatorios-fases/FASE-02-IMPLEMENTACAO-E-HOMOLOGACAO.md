# FASE 2 — Sites Multiempresa, Domínios, Branding e Empresa B

**Projeto:** Gauchinho Site

**Branch tip:** `main` = `feature/saas-foundation` = `12a5e61`

**Data desta execução / correção do relatório:** 2026-08-06

**Homologação pós-Migration 044 (UTC):** 2026-08-06 15:44

**Produção implantada (UTC):** 2026-08-06 19:36 Ready

> **FASE 2 — CONCLUÍDA E HOMOLOGADA EM PRODUÇÃO** (encerramento formal 2026-08-06). Código de produção `12a5e61`; commit documental final `b3e6247` (pushed). Deploy `dpl_F1uWUw…` Ready. Migration 044 aplicada. Domínio oficial resolve via `empresa_dominios` (`source=domain`); fallback emergencial mantido temporariamente (não usado nos hosts oficiais). Empresa B tenant de demonstração não publicada. Dados legados preservados. Fase 3 **não iniciada** (somente planejamento — ver `FASE-03-IMPLEMENTACAO-E-HOMOLOGACAO.md`).

---

## STATUS ATUAL

```
FASE 2 — CONCLUÍDA E HOMOLOGADA EM PRODUÇÃO
MIGRATION 044 — APLICADA E HOMOLOGADA
MAIN — ATUALIZADA (origin/main = b3e6247)
CÓDIGO DE PRODUÇÃO — 12a5e61
COMMIT DOCUMENTAL FINAL — b3e6247 (pushed)
DEPLOYMENT — dpl_F1uWUwUV1go5adBnNqat4eZXcse9
PRODUÇÃO — READY E OPERACIONAL
HOMOLOGAÇÃO PÚBLICA — APROVADA
HOMOLOGAÇÃO AUTENTICADA — APROVADA
EMPRESA B — CRIADA COMO TENANT DE DEMONSTRAÇÃO, NÃO PUBLICADA
FALLBACK EMERGENCIAL — MANTIDO TEMPORARIAMENTE
DADOS LEGADOS — PRESERVADOS (7 / 116 / 12 / 19 / 178 / 17)
FASE 3 — NÃO INICIADA (plano em análise)
```

**Aliases oficiais** (`gauchinhoconsorcios.com.br`, `www`, `guachinho-site.vercel.app`) apontam para o deployment de produção da Fase 2.

---

## 1. Bloqueio crítico — service role no cliente (CORRIGIDO)

### Grafo anterior (problemático)
```
Client Component (calculadoras/*)
  → @/lib/indices-financeiros (barrel)
    → repository.ts
      → @/lib/supabase/admin.ts  (SUPABASE_SERVICE_ROLE_KEY)
```

### Correção
- `lib/supabase/admin.ts`: `import "server-only"`.
- `lib/indices-financeiros/client-safe.ts`: funções puras (sem admin).
- `lib/indices-financeiros/index.ts` + `repository.ts`: `server-only`.
- Client Components importam **somente** `client-safe` / `types` / `math`.
- Build Next.js passa: bundler rejeitaria import de `server-only` no cliente.

### Verificação (código-fonte + artefatos `.next`, sem imprimir o valor da chave)
| Checagem | Resultado |
|---|---|
| Nome `SUPABASE_SERVICE_ROLE_KEY` em `src/` | Somente servidor (`admin.ts`, `resolve-by-host.ts`), testes e mensagem de UI de upload |
| `NEXT_PUBLIC_*` com service role | **Ausente** no código e em `.next` |
| String `service_role` em `.next/static` | **Ausente** |
| Valor real da chave em `.next/static` | **Ausente** |
| Valor real da chave em source maps cliente | **Ausente** |
| Chunk cliente `2ak9ouy2wek0m.js` | Contém **apenas o nome** da variável na mensagem de erro de upload (UI) |
| Bundle servidor do proxy (`[root-of-the-server]__176oic9._.js`) | Contém o **nome** da env (leitura via `process.env`); valor **não** embutido no prefixo verificado |

### Classificação SERVICE_ROLE / createAdminClient
| Ocorrência | Classificação |
|---|---|
| `lib/supabase/admin.ts` | Legítima + `server-only` |
| Route Handlers / Server Actions / libs server | Legítimas (servidor) |
| `proxy.ts` | **Não** lê service role; **não** importa `admin.ts` |
| `resolve-by-host.ts` | Lê `process.env.SUPABASE_SERVICE_ROLE_KEY` internamente; não exporta chave |
| UI admin (mensagem de erro upload) | Texto com **nome** da variável; sem valor |
| `.env.example` | Placeholder |
| `NEXT_PUBLIC_*` com service role | **Ausente** |

---

## 2. Proxy, runtime e segredos

### Grafo proxy → Supabase
```
proxy.ts
  → resolveTenantForRequest (lib/tenant/resolve-by-host.ts)
       → @supabase/supabase-js createClient
          (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY lidos no módulo de resolução)
  → @supabase/ssr createServerClient (anon — auth/cookies)
```

- **Não** importa `lib/supabase/admin.ts` (incompatível com o grafo do proxy + `server-only`).
- **Não** copia service role para header, resposta ou log.
- Headers `x-tenant-*` do cliente são removidos antes de setar valores confiáveis.
- `logTechnical` / `console.error` registram mensagens técnicas truncadas — **sem** valor de chave.

### Runtime efetivo (Next.js 16.2.9 + build local)
| Item | Evidência |
|---|---|
| Runtime do proxy / `_middleware` | **`nodejs`** em `.next/server/functions-config-manifest.json` |
| `@supabase/supabase-js` + service role | Presente no chunk servidor do middleware; funciona com `process.env` no runtime Node |
| Cache em memória (`Map`) | Suportado; `tenant-host-cache.ts` usa `Map` no módulo (compatível com Node) |
| `process.env` | Suportado no bundle servidor do proxy |
| APIs incompatíveis (Edge-only / `server-only` no proxy) | Proxy **não** importa `server-only`/`admin.ts`; NFT inclui `node-environment` / `node-crypto` |

---

## 3. Matriz completa de APIs (`app/api`)

| Rota | Método | Dados | Classe | Gauchinho | Empresa B | Proteção interna | Proxy |
|---|---|---|---|---|---|---|---|
| `/api/public/calculadoras/captura` | POST | lead captura calculadora | operacional Gauchinho | OK | 404 | assert + proxy | bloqueia |
| `/api/public/cartas/interesse` | POST | lead cartas | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/public/consultores` | GET | lista consultores | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/public/contratacoes/iniciar` | POST | contratação | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/public/contratacoes/rascunho/materializar` | POST | rascunho | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/public/contratacoes/rascunho/preview` | POST | preview | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/public/contratacoes/[token]` | GET/PATCH | contratação token | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/public/contratacoes/[token]/documentos` | GET/POST | docs | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/public/contratacoes/[token]/finalizar` | POST | finalizar | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/public/eventos` | POST | eventos | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/public/eventos/destaque` | GET | destaque | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/public/eventos/inscricao` | POST | inscrição | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/public/grupos/fluxo` | POST | fluxo grupos | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/public/grupos/sorteios` | GET | sorteios | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/public/imoveis/interesse` | POST | lead imóvel | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/public/indices-financeiros` | GET | índices | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/public/leads/especialista` | POST | lead | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/public/leads/ia-fallback` | POST | lead IA | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/public/leads/indicacao` | POST | indicação | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/public/simulador/captura` | POST | captura simulador | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/ia/chat` | POST | chat IA / leads | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/integration/grupos` | GET | grupos integração | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/integration/grupos/[id]` | GET | grupo | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/propostas/[id]/pdf` | GET | PDF proposta | operacional | OK | 404 | assert + proxy | bloqueia |
| `/api/admin/leads/export` | GET | export leads | administrativa | auth+perfil | 404 host B | assert + proxy + auth | bloqueia host B |
| `/api/admin/eventos/nps/export` | GET | export NPS | administrativa | auth | 404 host B | assert + proxy + auth | bloqueia host B |
| `/api/admin/eventos/[id]/participantes/export` | GET | export | administrativa | auth | 404 host B | assert + proxy + auth | bloqueia host B |
| `/api/admin/grupos/sorteios/buscar-federal` | GET | federal | administrativa | auth | 404 host B | assert + proxy + auth | bloqueia host B |
| `/api/auth/google-calendar/start` | GET | OAuth start | autenticação | legado | N/A* | auth própria | matcher |
| `/api/auth/google-calendar/callback` | GET | OAuth callback | autenticação/callback | legado | N/A* | auth própria | **skip tenant gate** |
| `/api/auth/google-calendar/disconnect` | POST | OAuth disconnect | autenticação | legado | N/A* | auth própria | matcher |
| `/api/cron/indices-financeiros` | GET | refresh índices | cron | secret cron | N/A | cron auth | **skip tenant gate** |

\*OAuth/cron: skip de **tenant** não é skip de **autenticação** (ver seção 5).

**Nenhuma rota restante “etc.” / “não analisada”.**

---

## 4. Defesa em profundidade nas APIs

- Helper: `evaluateLegacyOperationalApiAccess` / `rejectIfTenantBlocksLegacyOperationalApi`.
- Re-resolve pelo **Host**; **ignora** `x-tenant-*` do cliente.
- 28 Route Handlers operacionais/admin instrumentados.
- Testes sem proxy: `assert-legacy-operational-api.test.ts`.

---

## 5. Bypass de tenant (OAuth / Cron) ≠ bypass de autenticação

| Rota | Skip tenant no proxy? | Proteção própria ativa |
|---|---|---|
| `/api/auth/google-calendar/start` | Não (passa pelo matcher normal) | Usuário autenticado (`getUsuarioNegocio`) + `canManageLeads` + Gmail + sync habilitado |
| `/api/auth/google-calendar/disconnect` | Não | Usuário autenticado + `canManageLeads`; sem permissão → 403 |
| `/api/auth/google-calendar/callback` | **Sim** | Valida `code` + `state` vs cookie `google_calendar_oauth_state`; exige `google_calendar_oauth_uid`; `shouldBindGoogleOAuthToken` contra sessão atual; mismatch → redirect `session_mismatch` |
| `/api/cron/indices-financeiros` | **Sim** | Exige `CRON_SECRET` em `Authorization: Bearer …`; sem secret → 503; Bearer inválido → 401 |

---

## 6. Admin e host

Ordem no proxy para `/admin`:
1. Autenticação (sem sessão → `/login?next=`).
2. **Não** redireciona `/admin` para `/?modulo=indisponivel`.
3. Host institucional (≠ gauchinho): 403 em painel operacional; `/admin/empresas` segue para a página.
4. Página `/admin/empresas`: `isPlatformSuperadmin()` server-side.
5. Server Actions: `requireSuperadmin()` + validação de campos.

**Homologação:**
- Homologação unitária de autorização: **APROVADA** (testes).
- Homologação autenticada SuperAdmin no preview @ `6512f78`: **APROVADA** (ver §21). Homologação em produção @ `12a5e61`: **APROVADA** (ver §22).

---

## 7. Login em tenant de desenvolvimento

- `/login` no host Empresa B (dev): branding fictício permitido.
- Empresa B: sem usuários / sem `empresa_usuarios`.
- Login Gauchinho **não** cria vínculo com Empresa B.
- Auth Gauchinho preservada (cookies, redirects imobiliária, etc.).

---

## 8. Fallback emergencial

- Somente hosts oficiais; só com infra 044 ausente/inacessível ou erro transitório.
- `TODO(fase-2-pos-044)` de remoção.
- Log server-side sem segredo + cooldown 60s.
- Testes: oficial, desconhecido, Empresa B, erro transitório, cache separado.

---

## 9–11. Cache / Branding / Server Actions — testes

- Cache: positivo, negativo, erro curto, expiração, invalidação, separação de hosts (relógio injetável).
- Branding rules: fallback só Gauchinho; Empresa B não herda; RASCUNHO/PUBLICADO.
- Actions: bloqueio sem SuperAdmin; normalização domínio; rejeição localhost; invalidação cache.

---

## 12. Dependência `server-only`

- **Por quê:** enforçar no bundler Next que `admin.ts` / módulos server não entrem no Client Component graph.
- **Versão:** `^0.0.1` (pacote oficial Vercel/Next; API estável).
- Diff `package.json`: +1 dependência; lockfile atualizado.
- Sem duplicata.
- Vitest: alias para stub em `src/test-stubs/server-only.ts`.

---

## 13. Testes finais e commit

| Comando / item | Resultado |
|---|---|
| `npm test` | **84 files / 357 tests passed / 0 failed** |
| `npm run build` | **exit 0** — Proxy (Middleware) gerado |
| `npm run start` (porta 3010) | Runtime probes executados (ver abaixo) |

**Commit local realizado:**
`cc2b26ae8030bad364e8fd31aa023598cfef928d`

Mensagem: `feat(saas): implementa sites multiempresa, domínios e branding`

Escopo: 79 files, +3436 / −260.

### Runtime local (`next start`, NODE_ENV=production)

| Cenário | Resultado |
|---|---|
| Host oficial `gauchinhoconsorcios.com.br` | **200** (fallback emergencial Gauchinho — 044 não aplicada) |
| Host `www.gauchinhoconsorcios.com.br` | **200** |
| Host desconhecido | **404** `Site não configurado para este domínio.` |
| Injeção `x-tenant-slug: empresa-b` no host oficial | **200** Gauchinho (header ignorado; sem marcadores Empresa B) |
| `?__tenant=empresa-b` em production | **200** Gauchinho (override **não** aplicado; string `empresa-b` só ecoa na query RSC) |
| API operacional com host Empresa B / desconhecido | **404** site não configurado |
| `/admin` sem sessão | **307** → `/login?next=%2Fadmin` |
| Headers de resposta 404 | Sem nome/valor de service role |

---

## 14. Staging / Produção / Git

| Item | Status |
|---|---|
| Staging | não aplicado |
| Produção Migration 044 | **APLICADA** (ver §17) |
| Homologação em Supabase real (banco) | **REALIZADA** (ver §17) |
| Homologação pública pós-migration (sem deploy) | **REALIZADA** (ver §17.9) |
| Homologação autenticada SuperAdmin / `/admin/empresas` | **APROVADA** (preview §21 + produção §22) |
| Deploy preview do código Fase 2 | **REALIZADO** — `dpl_5UQW…` @ `6512f78` |
| Merge FF + deploy Production | **REALIZADO** — `main`/`12a5e61` → `dpl_F1uWUw…` Ready |
| Push `feature/saas-foundation` + `main` | **REALIZADO** |
| Produção do site (código) | **Fase 2 ativa** (`12a5e61` / `dpl_F1uWUw…`) |
| Fallback emergencial | **MANTIDO** |
| Fase 3 | **NÃO INICIADA** |

---

## 15. Fora do escopo do commit (confirmado)

Não entraram em `cc2b26a` / commits posteriores de código:

- `.claude/`
- `Adesivos/`
- `gauchinho-app/Logo e video/TABELA VEICULOS.png`
- `supabase/.temp/`
- `.env*`
- binários / arquivos de IDE / logs / dumps / artefatos `.next` / scripts temporários
- relatório FASE-01 (ainda untracked — fora desta autorização)

---

## 16. Pendências pós-Fase 2

| Pendência | Condição objetiva |
|---|---|
| Remoção do fallback emergencial de hosts oficiais | Somente após **período de estabilidade** em produção + **nova autorização explícita**. **Não remover nesta Fase 2.** |
| Início da implementação da Fase 3 | Somente após aprovação explícita do plano em `FASE-03-IMPLEMENTACAO-E-HOMOLOGACAO.md` |

Encerramento formal da Fase 2: **concluído** (§23). Merge/`main`/deploy/homologações: **concluídos** (§19–§22).

---

## 17. Homologação pós-Migration 044 (produção)

**Projeto Supabase:** `eaeuoynprurmmulzhydt` (Gauchinho-Site)  
**Branch:** `feature/saas-foundation`  
**CLI:** nativa `2.111.0` (`%LOCALAPPDATA%\supabase-cli\supabase.exe`)  
**Data/hora da validação:** 2026-08-06 15:44 UTC  
**Escopo:** somente leitura / HTTP público. Sem SQL Editor, sem repair, sem nova migration, sem deploy, sem git push.

### 17.1 Aplicação (evidência do operador) + dry-run posterior

| Item | Resultado |
|---|---|
| Comando de aplicação | `supabase db push --linked --yes` |
| Migration aplicada | `044_sites_multiempresa_dominios_branding.sql` |
| Dry-run posterior | `supabase db push --linked --dry-run` → `{"upToDate":true,"migrations":[],"message":"Remote database is up to date."}` |

Flags **não** usadas: `--include-all`, `--force`. Sem `migration repair`. Sem SQL Editor.

### 17.2 Histórico de migrations (`supabase migration list --linked`)

- **001 a 044** presentes em LOCAL e REMOTE (sincronizadas).
- Nenhuma migration pendente.
- Nenhuma migration desconhecida / divergente.
- `supabase_migrations.schema_migrations`: versões `001`…`044` contínuas.

### 17.3 Estrutura criada

| Objeto | Resultado |
|---|---|
| `public.empresa_dominios` | existe; **RLS = true** |
| `public.empresa_branding` | existe; **RLS = true** |

**empresa_dominios — colunas:** `id` (uuid PK, `gen_random_uuid()`), `empresa_id` (uuid NOT NULL → `empresas.id`), `tipo` (text), `valor` (text), `principal` (bool default false), `ativo` (bool default true), `verificado` (bool default false), `created_at` / `updated_at` (timestamptz default now()).

**empresa_branding — colunas:** `id`, `empresa_id` (UNIQUE FK), `nome_site`, `subtitulo`/`descricao_institucional` (default `''`), `logo_url`, `logo_claro_url`, `logo_escuro_url`, `favicon_url`, `cor_primaria`, `cor_secundaria`, `cor_destaque`, `telefone`/`whatsapp`/`email_contato` (default `''`), `redes_sociais` (jsonb default `{}`), `seo_titulo`, `seo_descricao`, `status_publicacao` (default `RASCUNHO`), `created_at`, `updated_at`.

**Índices relevantes:** `empresa_dominios_valor_ativo_idx` (único onde `ativo`), `empresa_dominios_principal_unico_idx` (único principal ativo por empresa), `empresa_dominios_empresa_idx`, PKs e unique de branding.

**Triggers:** `empresa_dominios_normalize` (BEFORE INSERT/UPDATE → `empresa_dominios_before_write`), `empresa_dominios_updated_at` / `empresa_branding_updated_at` (→ `set_updated_at`).

### 17.4 Funções / normalização (inspeção de schema — sem testes destrutivos)

| Regra | Evidência |
|---|---|
| Função `normalize_empresa_dominio_valor(text)` | presente (immutable) |
| Trigger de normalização | ativo |
| Trigger `updated_at` | ativo nas duas tabelas |
| Bloqueio localhost / `*.localhost` / IPs locais | no corpo de `empresa_dominios_before_write` |
| Bloqueio IP IPv4 literal | regex no trigger |
| Bloqueio wildcard `*` / espaços | no trigger |
| Strip de protocolo / path / query / fragment / `www.` / porta | na função de normalização |
| Valor em minúsculas | função + CHECK `empresa_dominios_valor_normalizado` |
| Unicidade domínio ativo | índice parcial único |
| Um principal ativo por empresa | índice parcial único |

### 17.5 Seed Gauchinho

| Campo | Valor remoto | OK |
|---|---|---|
| slug | `gauchinho` (1 linha, sem duplicação) | sim |
| domínio `valor` | `gauchinhoconsorcios.com.br` | sim |
| `principal` / `ativo` / `verificado` | true / true / true | sim |
| `empresa_id` | coincide com empresa gauchinho | sim |
| `nome_site` | Gauchinho Escritório de Soluções Financeiras | sim |
| subtitulo / descricao / telefone / whatsapp / email | vazios (`''`) | sim |
| cores | `#0A1628` / `#0D1F3C` / `#C9A84C` | sim |
| `logo_url` | null | sim |
| `status_publicacao` | `PUBLICADO` | sim |

Código novo **não** implantado → site público continua o comportamento legado (confirmado em §17.9).

### 17.6 Seed Empresa B

| Checagem | Resultado |
|---|---|
| slug / nome_fantasia | `empresa-b` / `Empresa B Consórcios` |
| cnpj | null |
| status / ativo | `em_treinamento` / `false` |
| branding | 1 linha, `RASCUNHO`, nome_site `Empresa B Consórcios` |
| domínio | **0** |
| `empresa_usuarios` | **0** |
| Tabelas com `empresa_id` no schema | só `empresa_dominios`, `empresa_branding`, `empresa_usuarios`, `papeis` — **sem** `empresa_id` em leads/propostas/grupos/contratações/agenda |

Sem dados operacionais vinculados à Empresa B (estrutura multiempresa operacional ainda não espalhada nas tabelas legadas).

### 17.7 Permissões, RLS, grants

**Permissão:** `gerenciar_site_empresa` criada; vinculada ao papel sistema `admin_empresa`.  
**SuperAdmin:** policies usam `is_platform_superadmin()` (funções da 043) → acesso global preservado nas policies.

**Policies exatas:**

| Tabela | Policy | cmd | roles | USING / WITH CHECK |
|---|---|---|---|---|
| empresa_dominios | empresa_dominios_select_policy | SELECT | authenticated | `is_platform_superadmin() OR is_company_member(empresa_id)` |
| empresa_dominios | empresa_dominios_write_policy | ALL | authenticated | `is_platform_superadmin() OR has_company_permission(empresa_id, 'gerenciar_site_empresa')` |
| empresa_branding | empresa_branding_select_policy | SELECT | authenticated | idem select |
| empresa_branding | empresa_branding_write_policy | ALL | authenticated | idem write |

**Grants / ACL observados:**

- `anon`: **nenhum** grant de tabela em `empresa_dominios` / `empresa_branding` (revoke efetivo).
- `authenticated` e `service_role`: ACL `arwdDxtm` (privilégios amplos de tabela).
- A 044 **não** executou `ALTER DEFAULT PRIVILEGES` nem `GRANT` global genérico; porém o schema `public` já possui **DEFAULT PRIVILEGES de plataforma** pré-existentes (`postgres` / `supabase_admin`) que concedem ALL em tabelas novas a `anon`/`authenticated`/`service_role` no momento do `CREATE TABLE`. A migration **revogou anon** nas duas tabelas; o acesso efetivo de `authenticated` continua **filtrado por RLS** (sem policy = sem linhas; policies exigem membership/permissão/superadmin).
- Função `normalize_empresa_dominio_valor`: EXECUTE também listado para `anon` (função pura de normalização; sem vazamento de dados). Mitigação principal permanece RLS nas tabelas.
- Usuário comum **não** ganha acesso global: policies exigem `is_company_member` / `has_company_permission` / superadmin.

### 17.8 Preservação de dados legados

| Tabela | Esperado | Remoto | Status |
|---|---|---|---|
| usuarios | 7 | 7 | OK |
| leads | 116 | 116 | OK |
| propostas | 12 | 12 | OK |
| grupos_consorcio | 19 | 19 | OK |
| grupos_cotas | 178 | 178 | OK |
| contratacoes_online | 17 | 17 | OK |

044 não altera tabelas operacionais legadas (confirmado pelo SQL da migration e pelas contagens idênticas).

### 17.9 Homologação pública sem deploy

Base: `https://www.gauchinhoconsorcios.com.br` (apex `gauchinhoconsorcios.com.br` redireciona para www, HTTP 200).

| Rota | HTTP | Gauchinho | Empresa B publicada | Erro 500 |
|---|---|---|---|---|
| `/` | 200 | sim | não | não |
| `/simulador` | 200 | sim | não | não |
| `/grupos` | 200 | sim | não | não |
| `/eventos` | 200 | sim | não | não |
| `/cartas-contempladas` | 200 | sim | não | não |
| `/oportunidades-imobiliarias` | 200 | sim | não | não |
| `/seguradoras` | 200 | sim | não | não |
| `/indicar` | 200 | sim | não | não |
| `/login` | 200 | sim | não | não |

Sem envio de lead/proposta/contratação; sem autenticação real nesta rodada.

### 17.10 O que NÃO foi feito nesta homologação

- git push *(naquele momento; push da branch ocorreu depois — ver §18)*
- deploy do código Fase 2 em produção
- remoção do fallback emergencial
- homologação autenticada SuperAdmin
- Fase 3
- alteração de código
- nova migration / repair / SQL Editor

---

## 18. Preview Deploy Vercel (feature/saas-foundation @ f720cbf)

**Data/hora:** 2026-08-06 ~12:03 (Horário Amazonas / UTC−4)  
**Conta/team:** `hugo-8097` / `hugo-8097s-projects`  
**Projeto:** `guachinho-site` (`prj_rcdKOewLz7V2FXEvmn3qHlyMiKMT`)  
**Root Directory (inalterado):** `gauchinho-app`  
**Domínio de produção (inalterado):** `gauchinhoconsorcios.com.br` / `www`  
**Git:** branch remota `feature/saas-foundation`, hash `f720cbfe747b2cc680f5bf99429e6882facf031c`

### 18.1 Decisões de execução

- Deploy a partir da **raiz do repositório** (não de `gauchinho-app/`), porque o Root Directory do projeto já é `gauchinho-app` — deploy de dentro da subpasta falha com path duplicado `gauchinho-app/gauchinho-app`.
- **Sem** `--prod`, **sem** promote, **sem** alias, **sem** alteração de domains/DNS, **sem** `env add/rm`, **sem** merge em `main`.
- Variáveis Preview confirmadas **por nome** (valores não impressos): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (sem prefixo `NEXT_PUBLIC`), `NEXT_PUBLIC_SITE_URL`, demais já existentes. Nenhuma variável de Production foi alterada.

### 18.2 Deployments de preview

| Item | Valor |
|---|---|
| Preview canônico (force rebuild) | `https://guachinho-site-d2g4rrpyv-hugo-8097s-projects.vercel.app` |
| Deployment ID | `dpl_6Ab1WjXFVpbKUSrp5RZtahyWbAZh` |
| Inspector | `https://vercel.com/hugo-8097s-projects/guachinho-site/6Ab1WjXFVpbKUSrp5RZtahyWbAZh` |
| Target | **preview** (`target: null` / não production) |
| ReadyState | **READY** |
| Build | Next.js 16.2.9; inclui `/admin/empresas`, `/admin/empresas/[id]`, `ƒ Proxy (Middleware)` |
| Warning | `engines.node >=20` (aviso de upgrade automático de major) |
| Preview anterior (substituído) | `dpl_F5r2wmkpF9Y8VjGpbPyZQ9mtJfn8` |

### 18.3 Produção após o preview

| Item | Resultado |
|---|---|
| Production deployment | **inalterado** `dpl_3XWLKjdzGuf1y9LmxhDod3tSguD7` (2026-08-04) |
| Aliases de produção | `gauchinhoconsorcios.com.br`, `www.gauchinhoconsorcios.com.br`, `guachinho-site.vercel.app`, `…-git-main-…` |
| Merge em `main` | **não realizado** |
| Promote / `--prod` | **não realizado** |

### 18.4 Homologação no preview — resultado (histórico @ `f720cbf`)

> Registro da tentativa no preview **pré-fix** (`dpl_6Ab1Wj…`). Superada pelo fix `6512f78` + novo preview `dpl_5UQW…` (§19–§21).

| Área | Status na época (§18) | Status atual |
|---|---|---|
| Build / rotas Fase 2 no artefato | **OK** | **OK** |
| Homologação pública funcional | bloqueada: host preview → `Site não configurado` + Deployment Protection | **APROVADA** no `dpl_5UQW…` (§20) |
| Homologação autenticada SuperAdmin | pendente | **APROVADA** (§21) |
| Perfis não autorizados | pendente | **APROVADOS** (§21) |
| Contagens legadas (banco) | **OK** | **OK** |
| Empresa B publicada / domínio / DNS | não | não |
| Fallback emergencial | mantido | mantido |
| Fase 3 | não iniciada | não iniciada |

### 18.5 Encaminhamento (histórico)

Na época: corrigir tenant em preview (§19), redeploy, homologar, e só então considerar promote/merge. **Concluído até homologação autenticada** (§19–§21). Promote/`--prod`/merge em `main` seguem **não autorizados**.

---

## 19. Correção — tenant Gauchinho em preview Vercel seguro

**Data:** 2026-08-06  
**Motivo:** após SSO no preview `dpl_6Ab1Wj…`, a resposta foi `Site não configurado para este domínio.`

### 19.1 Causa

- Host do preview (`guachinho-site-*-hugo-8097s-projects.vercel.app`) **não** está em `empresa_dominios` (e não deve ser cadastrado).
- Fallback emergencial só cobre `gauchinhoconsorcios.com.br` / `www`.
- Preview Vercel roda com `NODE_ENV=production`, então overrides de development (`?__tenant=`, `*.localhost`) não aplicam.

### 19.2 Correção (código — push autorizado e realizado)

Arquivos:

- `gauchinho-app/src/lib/tenant/vercel-preview-tenant.ts` (+ testes)
- `gauchinho-app/src/lib/tenant/resolve-by-host.ts`
- `gauchinho-app/src/lib/tenant/tenant-host-cache.ts` (source `vercel_preview_gauchinho`)
- testes em `resolve-by-host.test.ts`

Regras de segurança:

| Regra | Implementação |
|---|---|
| Só em preview | `VERCEL_ENV === "preview"` (bloqueia `production`) |
| Não genérico `*.vercel.app` | exige prefixo `guachinho-site-` + sufixo `-hugo-8097s-projects.vercel.app` |
| Cruzamento Host × ambiente | Host deve coincidir com `VERCEL_URL` e/ou `VERCEL_BRANCH_URL` quando presentes |
| Bloqueia produção do projeto | `guachinho-site.vercel.app` / `VERCEL_PROJECT_PRODUCTION_URL` |
| Sem query / x-tenant | não lidos por este caminho; `__tenant` só em `NODE_ENV=development` |
| Source identificável | `vercel_preview_gauchinho` |
| Cache | chave = host; preview e produção não compartilham a mesma chave |
| Empresa B | continua sem domínio; não é publicada |
| Migration 044 / Supabase | **não alterados** |

### 19.3 Testes e build (pré-push)

| Comando | Resultado |
|---|---|
| `npm test` | **85 files / 374 tests passed / 0 failed** |
| `npm run build` | **exit 0** |

### 19.4 Push (autorizado)

| Item | Valor |
|---|---|
| Branch | `feature/saas-foundation` |
| HEAD | `6512f788fa48ce8514a425e32d8a9cc1ac2be25a` |
| Mensagem | `fix(saas): permite tenant Gauchinho em preview seguro da Vercel` |
| Comando | `git push origin feature/saas-foundation` |
| Remote sync | `origin/feature/saas-foundation` = `6512f78` |
| Working tree | sem alterações rastreadas pendentes; untracked fora do escopo mantidos fora |
| Merge em `main` | **não realizado** |

---

## 20. Novo preview deploy @ `6512f78` + homologação

**Data:** 2026-08-06  
**Autorização:** push + preview sem `--prod` (produção intocada).

### 20.1 Pré-checks Vercel

| Check | Resultado |
|---|---|
| Projeto | `hugo-8097s-projects/guachinho-site` (`prj_rcdKOewLz7V2FXEvmn3qHlyMiKMT`) |
| Root Directory | `gauchinho-app` |
| Ambiente | **preview** (`target` ≠ production) |
| Hash implantado | `6512f788fa48ce8514a425e32d8a9cc1ac2be25a` (meta `githubCommitSha`) |
| Vars Preview | presentes por nome: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | **sem** prefixo `NEXT_PUBLIC_` (server-side) |
| `--prod` / promote / alias prod / DNS / env prod | **não executados** |

### 20.2 Novo deployment (canônico para homologação)

| Item | Valor |
|---|---|
| URL | `https://guachinho-site-51j7ozrgo-hugo-8097s-projects.vercel.app` |
| Deployment ID | `dpl_5UQWSkidZpty73bq592e6wPpKaR5` |
| Inspector | `https://vercel.com/hugo-8097s-projects/guachinho-site/5UQWSkidZpty73bq592e6wPpKaR5` |
| Status | **Ready** |
| Hash | `6512f78` |
| Target | preview |
| Build | exit OK; Next.js compilado; inclui `/admin/empresas` + Proxy/Middleware |
| Warning | `engines.node >=20` (upgrade automático de major — aviso Vercel) |
| Preview antigo (não reutilizado) | `dpl_6Ab1Wj…` / `…-d2g4rrpyv-…` — ainda responde `Site não configurado` |
| Preview git da branch (colateral do push) | `dpl_Emf9…` / `…-q3l54q8p8-…` @ `6512f78` (também Gauchinho; **evidência canônica = `dpl_5UQW…`**) |

### 20.3 Produção após o novo preview

| Item | Resultado |
|---|---|
| Production deployment | **inalterado** `dpl_3XWLKjdzGuf1y9LmxhDod3tSguD7` (2026-08-04) |
| Aliases de produção | `gauchinhoconsorcios.com.br`, `www.gauchinhoconsorcios.com.br`, `guachinho-site.vercel.app`, `…-git-main-…` |
| Merge em `main` | **não realizado** |
| Promote / `--prod` | **não realizado** |

### 20.4 Homologação no novo preview (`dpl_5UQW…`)

Método: `vercel curl` com bypass de Deployment Protection (SSO). **Não** reutilizar o preview antigo como evidência.

| # | Critério | Resultado |
|---|---|---|
| 1 | Home carrega Gauchinho (não “site não configurado”) | **OK** |
| 2 | Source de resolução `vercel_preview_gauchinho` | **OK** (comportamental: host de preview fora de `empresa_dominios` e fora do fallback emergencial oficial → Gauchinho; unit tests do source; preview antigo sem o fix ainda falha) |
| 3 | Rotas `/`, `/simulador`, `/grupos`, `/eventos`, `/cartas-contempladas`, `/oportunidades-imobiliarias`, `/seguradoras`, `/indicar`, `/login` | **OK** — todas com Gauchinho; sem “site não configurado”; sem Empresa B |
| 4 | `/admin/empresas` com SuperAdmin | **APROVADA** — ver §21 |
| 5 | Empresa B: `em_treinamento`; sem domínio; branding `RASCUNHO`; não publicada | **OK** (banco + UI SuperAdmin §21) |
| 6 | Sem sessão → login | **OK** — `307 Location: /login?next=%2Fadmin%2Fempresas` |
| 7 | Usuários sem SuperAdmin bloqueados | **APROVADA** — ver §21 |
| 8 | `?__tenant=empresa-b` ignorada | **OK** — home ainda Gauchinho; sem marcadores Empresa B |
| 9 | Headers `x-tenant-*` externos ignorados | **OK** — home ainda Gauchinho; sem Empresa B |
| 10 | Console/logs: sem 500; sem segredo; sem service role na resposta | **OK** nas respostas HTTP homologadas (sem `Internal Server Error`, sem `SERVICE_ROLE`, sem JWT `eyJhbGci` no HTML) |

**Não criados:** lead, proposta, contratação, domínio ou usuário.

### 20.5 Contraste com preview antigo (bug)

| Deployment | Hash / era | Home |
|---|---|---|
| `dpl_6Ab1Wj…` (antigo) | pré-fix | `Site não configurado…` |
| `dpl_5UQW…` (novo) | `6512f78` | Gauchinho |

### 20.6 Estado operacional pós-homologação pública

- Fallback emergencial de hosts oficiais: **mantido**
- Migration 044: **inalterada** / já aplicada
- Empresa B: **não publicada**
- Fase 3: **não iniciada**
- Promote / `--prod` / merge `main`: **não realizados**

---

## 21. Homologação autenticada no preview canônico (`dpl_5UQW…` @ `6512f78`)

**Data:** 2026-08-06  
**URL:** `https://guachinho-site-51j7ozrgo-hugo-8097s-projects.vercel.app`  
**Deployment:** `dpl_5UQWSkidZpty73bq592e6wPpKaR5`  
**Hash:** `6512f788fa48ce8514a425e32d8a9cc1ac2be25a`

**Método:** sessão Auth obtida via `auth.admin.generateLink` + `verifyOtp` (sem alterar senhas, sem criar usuários); requisições HTTP ao preview via `vercel curl` + Cookie (bypass Deployment Protection). **Nenhuma edição/salvamento** em domínio, branding, empresa ou usuário.

IDs usados (somente leitura):

| Tenant | ID |
|---|---|
| Gauchinho | `7170f38e-15dd-4b19-8588-51e9a9cf0d4c` |
| Empresa B | `8e4e13f9-80e6-44db-a21b-584a43b6f024` |

### 21.1 SuperAdmin — **APROVADA**

Perfil: usuário plataforma com papel `super_admin` / escopo `PLATFORM` (mesmo vínculo já documentado na Fase 1).

| Critério | Resultado |
|---|---|
| Login / sessão válida | **OK** — `/admin/empresas` **200** |
| Sessão preservada | **OK** — segunda chamada com o mesmo Cookie **200** |
| `/admin/empresas` acessível | **OK** — título `Empresas (Plataforma SaaS)` |
| Gauchinho listada | **OK** — linha `Gauchinho Consórcios / gauchinho / ativo / Sim` |
| Empresa B listada | **OK** — linha `Empresa B Consórcios / empresa-b / em_treinamento / Não` |
| Detalhe Gauchinho | **OK** — domínio `gauchinhoconsorcios.com.br` principal/ativo/verificado = Sim; status `ativo`; branding `PUBLICADO` |
| Detalhe Empresa B | **OK** — status `em_treinamento`; branding `RASCUNHO`; `Nenhum domínio cadastrado`; sem domínio Gauchinho na página |
| Sem vazamento de tenant no H1 | **OK** — H1 de cada detalhe corresponde ao tenant |

### 21.2 Acesso direto por URL — **APROVADA**

| URL | SuperAdmin | Master legado (sem SuperAdmin) | Consultor | Sem sessão |
|---|---|---|---|---|
| `/admin/empresas` | **200** lista | **307** → `/admin` | **307** → `/admin` | **307** → `/login?next=…` |
| `/admin/empresas/[gauchinho]` | **200** detalhe | **307** → `/admin` | **307** → `/admin` | **307** → login |
| `/admin/empresas/[empresa-b]` | **200** detalhe | **307** → `/admin` | — | — |

Somente SuperAdmin acessa o conteúdo de `/admin/empresas*`.

### 21.3 Perfis não autorizados — **APROVADA**

Credenciais/senhas **não** foram alteradas nem inventadas. Sessões efêmeras geradas só para leitura no preview.

| Perfil | Conta usada (papel) | Resultado |
|---|---|---|
| Sem sessão | — | **307** → `/login?next=%2Fadmin%2Fempresas` |
| Master legado sem SuperAdmin | `admin_empresa` / COMPANY (perfil legado `master`) | **307** → `/admin` (bloqueado na página) |
| Consultor | `consultor` / COMPANY | **307** → `/admin` (bloqueado na página) |

Nenhum perfil pendente por falta de credencial segura nesta rodada.

### 21.4 Server actions sem autorização — **APROVADA** (testes unitários, sem persistir)

```
vitest run src/app/admin/empresas/actions.test.ts
→ 5 passed
```

Cobertura: `fetchEmpresasList`, `createDominioAction`, `upsertBrandingAction` rejeitam sem SuperAdmin; SuperAdmin mock valida normalização de domínio / rejeita localhost. **Nenhuma** action de escrita executada contra o preview/produção.

### 21.5 Logs / respostas

| Check | Resultado |
|---|---|
| Erro 500 | **não observado** |
| Loop de redirect | **não observado** (307 único para login ou `/admin`) |
| Erro RLS na UI | **não observado** |
| Segredo / JWT / `SERVICE_ROLE` na resposta | **ausentes** |
| Vazamento Gauchinho ↔ Empresa B nos detalhes | **não observado** (domínio Gauchinho só na página Gauchinho; Empresa B sem domínio) |

### 21.6 Restrições respeitadas (na etapa de preview)

- Sem promote / `--prod` / merge `main` **nessa etapa**
- Sem alteração Supabase / domínio / publicação Empresa B
- Fallback emergencial **mantido**
- Fase 3 **não iniciada**

---

## 22. Produção — Opção B (merge FF + deploy Vercel)

**Data:** 2026-08-06  
**Autorização:** Opção B — merge `feature/saas-foundation` → `main` + deploy automático Production (sem `vercel --prod`, sem promote manual, sem DNS/env).

### 22.1 Pré-checks Git

| Check | Resultado |
|---|---|
| `origin/main` pré-merge | `f7ba538` (inalterado desde o diagnóstico) |
| `origin/feature/saas-foundation` | `12a5e613c2c531bf88c748dc7dce26de681c57f1` |
| `merge-base --is-ancestor origin/main origin/feature…` | exit **0** (FF possível) |
| Diff | 89 files / Fases 1–2 homologadas; sem untracked de escopo |

### 22.2 Merge e push

| Passo | Resultado |
|---|---|
| `git switch main` + `pull --ff-only` | OK |
| `git merge --ff-only origin/feature/saas-foundation` | **OK** `f7ba538..12a5e61` |
| HEAD `main` | `12a5e61` |
| `git push origin main` | **OK** (sem force) |
| `origin/main` | `12a5e61` |

### 22.3 Deployment Production

| Item | Valor |
|---|---|
| Projeto | `hugo-8097s-projects/guachinho-site` |
| Root Directory | `gauchinho-app` |
| Deployment ID | `dpl_F1uWUwUV1go5adBnNqat4eZXcse9` |
| URL | `https://guachinho-site-k00zz63b6-hugo-8097s-projects.vercel.app` |
| Hash | `12a5e613c2c531bf88c748dc7dce26de681c57f1` |
| Target | **production** |
| Status | **Ready** |
| Created / Ready (UTC) | 2026-08-06 19:35:47 / 19:36:40 |
| Build | Next.js compilado com sucesso (~13.2s) |
| Warning | `engines.node >=20` (aviso Vercel) |
| Aliases | `gauchinhoconsorcios.com.br`, `www.gauchinhoconsorcios.com.br`, `guachinho-site.vercel.app`, `…-git-main-…` |
| Método | deploy automático por push em `main` (**não** `--prod` / promote / alias manual) |
| Deployment anterior | `dpl_3XWLK…` substituído nos aliases oficiais |

### 22.4 Homologação pública em produção — **APROVADA**

Hosts: `https://gauchinhoconsorcios.com.br` (308 → www) e `https://www.gauchinhoconsorcios.com.br`.

| Rota | Status | Gauchinho | Empresa B | 500 / segredo |
|---|---|---|---|---|
| `/` (apex + www) | 200 (www) | sim | não | não |
| `/simulador` … `/login` (lista autorizada) | 200 | sim | não | não |

| Critério | Resultado |
|---|---|
| Domínio oficial em `empresa_dominios` | **sim** — `gauchinhoconsorcios.com.br` principal/ativo/verificado |
| Source esperada | **`domain`** (hit em `empresa_dominios`; fallback **não** necessário nesta resolução) |
| Source `vercel_preview_gauchinho` | **não** (só `VERCEL_ENV=preview`) |
| Host de deployment Production (não oficial) | **404** `Site não configurado…` |
| Visual / APIs públicas smoke | sem 500 observado nas rotas testadas |

### 22.5 Segurança de tenant em produção — **APROVADA**

| Teste | Resultado |
|---|---|
| `?__tenant=empresa-b` | ignorado — 200 Gauchinho |
| `x-tenant-slug: empresa-b` | ignorado — 200 Gauchinho |
| `x-tenant-empresa-id` externo | ignorado — 200 Gauchinho |
| Empresa B domínio / branding publicado | **0 domínios** / `RASCUNHO` / `em_treinamento` / `ativo=false` |
| Service role / JWT na resposta | **ausentes** |

### 22.6 Homologação autenticada em produção — **APROVADA**

Base: `https://www.gauchinhoconsorcios.com.br` (sessão via `generateLink`+`verifyOtp`; sem editar/salvar).

| Critério | Resultado |
|---|---|
| SuperAdmin `/admin/empresas` | **200** — Gauchinho + Empresa B listadas |
| Sessão preservada | **OK** |
| Gauchinho detalhe | domínio principal/ativo/verificado; branding **PUBLICADO** |
| Empresa B detalhe | `em_treinamento`; branding **RASCUNHO**; `Nenhum domínio cadastrado` |
| Sem sessão | **307** → `/login?next=%2Fadmin%2Fempresas` |
| Master legado sem SuperAdmin | **307** → `/admin` |
| Consultor | **307** → `/admin` |

### 22.7 Contagens legadas (somente leitura)

| Tabela | Esperado | Observado |
|---|---|---|
| usuarios | 7 | **7** |
| leads | 116 | **116** |
| propostas | 12 | **12** |
| grupos_consorcio | 19 | **19** |
| grupos_cotas | 178 | **178** |
| contratacoes_online | 17 | **17** |

### 22.8 Fallback emergencial

- **Mantido** no código.
- Em produção nos hosts oficiais: resolução por **`empresa_dominios`** (`source=domain`); fallback **não utilizado** neste caminho.
- Host de deployment Production sem domínio cadastrado: falha fechada (404), sem acionar fallback de hosts oficiais.

### 22.9 Restrições respeitadas

- Sem alteração DNS / env / publicação Empresa B
- Sem nova migration
- Sem remoção do fallback
- Fase 3 **não iniciada**

---

## 23. Encerramento formal da Fase 2

**Data:** 2026-08-06  
**Commit documental final (pushed):** `b3e62479f9e901a2298ada50b5e37417044741f6`

### 23.1 Declaração

A Fase 2 (Sites Multiempresa, Domínios, Branding e Empresa B) está **CONCLUÍDA E HOMOLOGADA EM PRODUÇÃO**.

| Item | Status |
|---|---|
| Migration 044 | **APLICADA E HOMOLOGADA** |
| Main | **ATUALIZADA** (`origin/main` = `b3e6247`) |
| Código de produção (app) | **`12a5e61`** |
| Commit documental final | **`b3e6247`** |
| Deployment | **`dpl_F1uWUwUV1go5adBnNqat4eZXcse9`** |
| Produção | **READY E OPERACIONAL** |
| Homologação pública | **APROVADA** |
| Homologação autenticada | **APROVADA** |
| Empresa B | **CRIADA COMO TENANT DE DEMONSTRAÇÃO, NÃO PUBLICADA** |
| Fallback emergencial | **MANTIDO TEMPORARIAMENTE** |
| Dados legados | **PRESERVADOS** |
| Fase 3 | **NÃO INICIADA** |

### 23.2 Evidências operacionais do encerramento

- Domínio oficial resolveu via **`empresa_dominios`** (`gauchinhoconsorcios.com.br` principal/ativo/verificado).
- Source de resolução nos hosts oficiais: **`domain`**.
- Fallback emergencial **não foi utilizado** nos hosts oficiais (mantido no código como rede de segurança).
- Empresa B: **sem domínio**; branding **`RASCUNHO`**; status **`em_treinamento`**; `ativo=false`.
- Nenhuma tabela operacional legada recebeu `empresa_id` nesta fase.
- Contagens legadas permaneceram: **usuarios 7 / leads 116 / propostas 12 / grupos_consorcio 19 / grupos_cotas 178 / contratacoes_online 17**.

### 23.3 Pendência explícita — fallback

Não remover o fallback emergencial sem nova autorização. Critério sugerido: estabilidade pós-produção confirmada + decisão formal documentada.

---

## STATUS FINAL

```
FASE 2 — CONCLUÍDA E HOMOLOGADA EM PRODUÇÃO
MIGRATION 044 — APLICADA E HOMOLOGADA
MAIN — ATUALIZADA (b3e6247)
CÓDIGO DE PRODUÇÃO — 12a5e61
COMMIT DOCUMENTAL FINAL — b3e6247
DEPLOYMENT — dpl_F1uWUwUV1go5adBnNqat4eZXcse9 READY E OPERACIONAL
HOMOLOGAÇÃO PÚBLICA — APROVADA
HOMOLOGAÇÃO AUTENTICADA — APROVADA
EMPRESA B — TENANT DE DEMONSTRAÇÃO, NÃO PUBLICADA
FALLBACK EMERGENCIAL — MANTIDO TEMPORARIAMENTE
DADOS LEGADOS — PRESERVADOS (7 / 116 / 12 / 19 / 178 / 17)
SOURCE OFICIAL — domain (fallback não usado nos hosts oficiais)
FASE 3 — NÃO INICIADA
```
