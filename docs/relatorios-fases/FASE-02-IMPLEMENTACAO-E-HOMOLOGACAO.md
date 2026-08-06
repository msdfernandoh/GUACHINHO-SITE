# FASE 2 — Sites Multiempresa, Domínios, Branding e Empresa B

**Projeto:** Gauchinho Site

**Branch:** `feature/saas-foundation`

**Data desta execução / correção do relatório:** 2026-08-06

**Homologação pós-Migration 044 (UTC):** 2026-08-06 15:44

> Código e relatório da Fase 2 estão na branch remota `feature/saas-foundation` (`f720cbf`). Migration 044 aplicada e homologada. **Preview Vercel criado** (`dpl_6Ab1Wj…`); **produção não alterada**. Homologação funcional do preview pendente por Deployment Protection (SSO). Fallback mantido. Fase 3 não iniciada.

---

## STATUS ATUAL

```
FASE 2 — PREVIEW DEPLOY CRIADO (PRODUÇÃO NÃO ALTERADA)
PREVIEW — READY
PRODUÇÃO — CÓDIGO ANTIGO (main / dpl_3XWLK…)
GIT PUSH — REALIZADO (feature/saas-foundation @ f720cbf)
MERGE EM MAIN — NÃO REALIZADO
DEPLOY --prod — NÃO REALIZADO
HOMOLOGAÇÃO PÚBLICA NO PREVIEW — BLOQUEADA POR DEPLOYMENT PROTECTION (SSO)
HOMOLOGAÇÃO AUTENTICADA NO PREVIEW — PENDENTE (requer acesso SSO + SuperAdmin)
FALLBACK EMERGENCIAL — MANTIDO
FASE 3 — NÃO INICIADA
```

**Produção (`gauchinhoconsorcios.com.br`) permanece no deploy antigo.** O preview exige autenticação Vercel (SSO); homologação funcional completa no preview fica pendente de acesso autenticado.

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
- Homologação autenticada manual com SuperAdmin: **PENDENTE** (Migration 044 ainda não aplicada; não há tela homologada em produção).

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
| Homologação autenticada SuperAdmin / `/admin/empresas` | **PENDENTE** |
| Deploy do código Fase 2 | **NÃO REALIZADO** |
| Commit local código | **REALIZADO** — `cc2b26ae8030bad364e8fd31aa023598cfef928d` |
| Commit local relatório | **REALIZADO** — `a2eb815` (este MD será atualizado novamente pós-homologação) |
| Push | **NÃO REALIZADO** |
| Produção do site (código) | **código antigo ainda ativo** |
| Fallback emergencial | **MANTIDO** |
| Fase 3 | **NÃO INICIADA** |

---

## 15. Fora do escopo do commit (confirmado)

Não entraram em `cc2b26a`:

- `.claude/`
- `Adesivos/`
- `gauchinho-app/Logo e video/TABELA VEICULOS.png`
- `supabase/.temp/`
- `.env*`
- binários / arquivos de IDE / logs / dumps / artefatos `.next` / scripts temporários
- relatório FASE-01 (ainda untracked — fora desta autorização)

---

## 16. Pendências (próximas autorizações)

- homologação autenticada SuperAdmin (`/admin/empresas`);
- autorização para git push;
- autorização para deploy do código Fase 2;
- remoção futura do fallback emergencial (somente após 044 + código novos homologados juntos);
- Fase 3 — **não iniciar** sem autorização explícita.

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

### 18.4 Homologação no preview — resultado

**Bloqueio:** Deployment Protection / **Vercel SSO** no preview. Requisições HTTP anônimas recebem **302** para `vercel.com/sso-api` (página de autenticação ~488KB). `vercel curl` também redireciona para SSO nesta configuração.

| Área | Status |
|---|---|
| Build / rotas Fase 2 presentes no artefato | **OK** (evidência no log de build) |
| Homologação pública funcional (HTML Gauchinho, rotas, tenant, APIs) | **PENDENTE** — requer login SSO Vercel no preview |
| Homologação autenticada SuperAdmin `/admin/empresas` | **PENDENTE** — requer SSO + sessão SuperAdmin |
| Perfis (master/consultor/sem sessão) | **PENDENTE** no preview |
| Contagens legadas (banco) | **OK** — 7 / 116 / 12 / 19 / 178 / 17 (reconfirmadas 2026-08-06) |
| Empresa B publicada / domínio real / DNS | **não** — sem alteração |
| Fallback emergencial | **mantido** |
| Fase 3 | **não iniciada** |

### 18.5 Pendências para autorização seguinte

1. Homologar o preview **com sessão Vercel SSO** após redeploy do fix §19.
2. Homologar `/admin/empresas` com SuperAdmin no preview.
3. Só então autorizar promote/`--prod` ou merge em `main` (escolha explícita).
4. Manter fallback emergencial de hosts oficiais até decisão formal pós-produção.

---

## 19. Correção — tenant Gauchinho em preview Vercel seguro

**Data:** 2026-08-06  
**Motivo:** após SSO no preview `dpl_6Ab1Wj…`, a resposta foi `Site não configurado para este domínio.`

### 19.1 Causa

- Host do preview (`guachinho-site-*-hugo-8097s-projects.vercel.app`) **não** está em `empresa_dominios` (e não deve ser cadastrado).
- Fallback emergencial só cobre `gauchinhoconsorcios.com.br` / `www`.
- Preview Vercel roda com `NODE_ENV=production`, então overrides de development (`?__tenant=`, `*.localhost`) não aplicam.

### 19.2 Correção (código local — aguarda push/redeploy)

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

### 19.3 Testes e build

| Comando | Resultado |
|---|---|
| `npm test` | **85 files / 374 tests passed / 0 failed** |
| `npm run build` | **exit 0** |

### 19.4 Estado operacional

- Produção: **inalterada** (código antigo em `main`).
- Migration 044: **não alterada**.
- Empresa B: **não publicada**.
- Push / novo preview / promote: **não realizados** nesta etapa (aguardam autorização).

---

## STATUS FINAL

```
FASE 2 — CORREÇÃO PREVIEW VERCEL COMMITÁVEL LOCALMENTE
PREVIEW ANTERIOR — 404 ESPERADO (host não cadastrado)
FIX — vercel_preview_gauchinho (só VERCEL_ENV=preview + host oficial do projeto)
TESTES — 374 passed
PRODUÇÃO — INALTERADA
MIGRATION 044 — INALTERADA
EMPRESA B — NÃO PUBLICADA
PUSH / REDEPLOY PREVIEW — AGUARDANDO AUTORIZAÇÃO
MAIN — SEM MERGE
FASE 3 — NÃO INICIADA
```
