# FASE 2 — Sites Multiempresa, Domínios, Branding e Empresa B

**Projeto:** Gauchinho Site
**Branch:** `feature/saas-foundation`
**Data desta execução:** 2026-08-06

> A implementação anterior foi criada localmente antes da aprovação formal do plano revisado e foi tratada como **rascunho não aprovado**. Esta execução realizou auditoria, correção dos bloqueios críticos e revalidação antes de qualquer commit.

---

## STATUS ATUAL

```
FASE 2 — IMPLEMENTAÇÃO LOCAL EM AUDITORIA FINAL
MIGRATION 044 — NÃO APLICADA
COMMIT — NÃO REALIZADO
PUSH — NÃO REALIZADO
DEPLOY — NÃO REALIZADO
FASE 3 — NÃO INICIADA
```

**Não declarar pronta para produção** até: service role isolada (feito), APIs classificadas (feito), proteção interna comprovada (feito), testes admin (feitos em unitário; homologação autenticada manual pendente).

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

### Verificação
- `rg` em `src/components`: **zero** imports de `@/lib/supabase/admin` ou barrel `@/lib/indices-financeiros`.
- `npm run build` exit 0.

### Classificação SERVICE_ROLE / createAdminClient
| Ocorrência | Classificação |
|---|---|
| `lib/supabase/admin.ts` | Legítima + `server-only` |
| Route Handlers / Server Actions / `server/*` / libs server | Legítimas (servidor) |
| `proxy.ts` | **Não** lê service role; não importa `admin.ts` |
| `resolve-by-host.ts` | Lê env internamente (Edge-safe); não exporta chave |
| UI admin (mensagem de erro upload) | Texto sem chave |
| `.env.example` | Placeholder |
| `NEXT_PUBLIC_*` com service role | **Ausente** |

---

## 2. Proxy e segredos

### Grafo proxy → Supabase
```
proxy.ts
  → resolveTenantForRequest (lib/tenant/resolve-by-host.ts)
       → @supabase/supabase-js createClient
          (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY lidos no módulo de resolução)
  → @supabase/ssr createServerClient (anon — auth/cookies)
```

- **Não** importa `lib/supabase/admin.ts` (incompatível com Edge + server-only).
- **Não** copia service role para header/resposta/log.
- Headers `x-tenant-*` do cliente são removidos antes de setar valores confiáveis.

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

\*OAuth/cron: não são superfície multiempresa da Empresa B; gate de tenant ignorado propositalmente.

**Nenhuma rota restante “etc.” / “não analisada”.**

---

## 4. Defesa em profundidade nas APIs

- Helper: `evaluateLegacyOperationalApiAccess` / `rejectIfTenantBlocksLegacyOperationalApi`.
- Re-resolve pelo **Host**; **ignora** `x-tenant-*` do cliente.
- 28 Route Handlers operacionais/admin instrumentados.
- Testes sem proxy: `assert-legacy-operational-api.test.ts`.

---

## 5. Admin e host

Ordem no proxy para `/admin`:
1. Autenticação (sem sessão → `/login?next=`).
2. **Não** redireciona `/admin` para `/?modulo=indisponivel`.
3. Host institucional (≠ gauchinho): 403 em painel operacional; `/admin/empresas` segue para a página.
4. Página `/admin/empresas`: `isPlatformSuperadmin()` server-side.
5. Server Actions: `requireSuperadmin()` + validação de campos.

---

## 6. Login em tenant de desenvolvimento

- `/login` no host Empresa B (dev): branding fictício permitido.
- Empresa B: sem usuários / sem `empresa_usuarios`.
- Login Gauchinho **não** cria vínculo com Empresa B.
- Auth Gauchinho preservada (cookies, redirects imobiliária, etc.).

---

## 7. Fallback emergencial

- Somente hosts oficiais; só com infra 044 ausente/inacessível ou erro transitório.
- `TODO(fase-2-pos-044)` de remoção.
- Log server-side sem segredo + cooldown 60s.
- Testes: oficial, desconhecido, Empresa B, erro transitório, cache separado.

---

## 8–10. Cache / Branding / Server Actions — testes

- Cache: positivo, negativo, erro curto, expiração, invalidação, separação de hosts (relógio injetável).
- Branding rules: fallback só Gauchinho; Empresa B não herda; RASCUNHO/PUBLICADO.
- Actions: bloqueio sem SuperAdmin; normalização domínio; rejeição localhost; invalidação cache.

---

## 11. Dependência `server-only`

- **Por quê:** enforçar no bundler Next que `admin.ts` / módulos server não entrem no Client Component graph.
- **Versão:** `^0.0.1` (pacote oficial Vercel/Next; API estável).
- Diff `package.json`: +1 dependência; lockfile atualizado.
- Sem duplicata.
- `npm audit --omit=dev`: sem vulnerabilidades reportadas no momento da verificação.
- Vitest: alias para stub em `src/test-stubs/server-only.ts`.

---

## 12. Testes finais

| Comando | Resultado |
|---|---|
| `npm test` | **84 files / 357 tests passed / 0 failed** |
| `npm run build` | **exit 0** — `ƒ Proxy (Middleware)` |

---

## 13. Staging / Produção / Git

| Item | Status |
|---|---|
| Staging | não aplicado |
| Produção Migration 044 | **não aplicada** |
| Deploy | **não realizado** |
| Commit | **não realizado** |
| Push | **não realizado** |

---

## 14. Fora do escopo de commit

- `.claude/`
- `Adesivos/`
- `gauchinho-app/Logo e video/TABELA VEICULOS.png`
- `supabase/.temp/`
- `.env*`
- relatório FASE-01 (já existente não rastreado — fora desta autorização)

---

## 15. Pendências para autorização de commit

1. Revisão humana deste relatório / matriz de APIs.
2. Homologação autenticada SuperAdmin (manual).
3. Autorização explícita de commit (sem push/deploy/044).
4. Após 044 homologada: remover fallback emergencial.
