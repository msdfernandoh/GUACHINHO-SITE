# FASE 2 — Sites Multiempresa, Domínios, Branding e Empresa B

**Projeto:** Gauchinho Site

**Branch:** `feature/saas-foundation`

**Data desta execução / correção do relatório:** 2026-08-06

> A implementação anterior foi criada localmente antes da aprovação formal do plano revisado e foi tratada como **rascunho não aprovado**. Esta execução realizou auditoria, correção dos bloqueios críticos, revalidação, **commit local** e validação por testes. **Não** houve push, aplicação da Migration 044 nem deploy.

---

## STATUS ATUAL

```
FASE 2 — IMPLEMENTAÇÃO LOCAL COMMITADA E VALIDADA POR TESTES
COMMIT — REALIZADO
Commit: cc2b26ae8030bad364e8fd31aa023598cfef928d
PUSH — NÃO REALIZADO
MIGRATION 044 — NÃO APLICADA
HOMOLOGAÇÃO EM SUPABASE REAL — PENDENTE
HOMOLOGAÇÃO AUTENTICADA — PENDENTE
DEPLOY — NÃO REALIZADO
PRODUÇÃO — INALTERADA
FASE 3 — NÃO INICIADA
```

**Não declarar pronta para produção.** A tela `/admin/empresas` **não** está homologada em produção (Migration 044 ausente + homologação autenticada SuperAdmin pendente).

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
| Produção Migration 044 | **NÃO APLICADA** |
| Homologação em Supabase real | **PENDENTE** |
| Homologação autenticada SuperAdmin | **PENDENTE** |
| Deploy | **NÃO REALIZADO** |
| Commit local | **REALIZADO** — `cc2b26ae8030bad364e8fd31aa023598cfef928d` |
| Push | **NÃO REALIZADO** |
| Produção | **INALTERADA** |
| Fase 3 | **NÃO INICIADA** |

> Este relatório foi corrigido no working tree **após** o commit `cc2b26a` para eliminar contradições de status. Aguarda autorização explícita para um commit documental de sincronização, se desejado.

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

`git status --short` após o commit (estado observado na correção do relatório): working tree com este MD modificado + untracked acima — **sem** staging de segredos.

---

## 16. Pendências (próximas autorizações)

- revisão final do commit;
- homologação da Migration 044 em ambiente real;
- homologação autenticada SuperAdmin;
- autorização para push;
- autorização para aplicação em produção;
- autorização para deploy;
- remoção futura do fallback emergencial.

---

## STATUS FINAL

```
FASE 2 — IMPLEMENTAÇÃO LOCAL COMMITADA E VALIDADA POR TESTES
MIGRATION 044 — NÃO APLICADA
HOMOLOGAÇÃO EM SUPABASE REAL — PENDENTE
HOMOLOGAÇÃO AUTENTICADA — PENDENTE
PUSH — NÃO REALIZADO
DEPLOY — NÃO REALIZADO
PRODUÇÃO — INALTERADA
FASE 3 — NÃO INICIADA
```
)
