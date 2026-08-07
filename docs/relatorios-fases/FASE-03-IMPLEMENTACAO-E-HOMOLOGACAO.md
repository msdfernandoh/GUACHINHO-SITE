# FASE 3 SaaS — Escopo oficial final + plano técnico (documental)

**Título:** Participantes Comerciais e Sites de Parceiros  
**Fonte canônica:** `docs/SAAS-MASTER-ARCHITECTURE.md` §5 e §5.1  
**Roadmap legado (não numera SaaS):** `docs/PLANO-EXECUCAO-FASES.md`  
**Data:** 2026-08-06  

> **Autorização atual:** E0–E6 (045 homologada; admin sites + Vercel module + resolver runtime sob flags).  
> **Não autorizado nesta rodada:** domínio/DNS real, site público E8, área comercial E7, preview/prod deploy, push do commit E6, merge main, fallback, Empresa B, Fase 4.

---

## Matriz de governança

| Dimensão | Status |
|---|---|
| Título Fase 3 | **Confirmado** |
| Princípios P1–P15 | **Confirmados** |
| Blocos A/B + sites/domínios + Q1–Q5 | **Confirmados** |
| Escopo oficial | **FINAL** |
| E0 branch | **Feito** `feature/saas-fase-3-participantes-parceiros` |
| E1 migration 045 | **Aplicada e homologada** (ver §16) |
| E2 libs | **Feito** |
| E3 admin participantes/orgs | **Feito** (flag off; fora do menu) |
| E4 admin parceiro-sites | **Feito** (flag off; fora do menu) |
| E5 domínios + Vercel server-side + gates | **Feito** (flag Vercel off; sem domínio/DNS real) |
| E6 resolver runtime (path/subdomínio/domínio) | **Feito** (flag pública off; sem servir site) |
| E7–E10 | **Não iniciados** |
| Push branch feature | **Feito** até `0e87dfa` (E5); commit E6 **local, sem push** |
| Domínio real / DNS real / deploy / main | **Intocados** |

---

## STATUS

```
FASE 3 — MIGRATION 045 APLICADA E BANCO HOMOLOGADO
E0–E6 — IMPLEMENTADOS
TELAS / VERCEL / SITE PÚBLICO — FLAGS OFF
RESOLVER PARCEIRO — CÓDIGO PRONTO (NÃO SERVE PÚBLICO)
NENHUM DOMÍNIO REAL / DNS / DEPLOY
ÁREA COMERCIAL — NÃO IMPLEMENTADA
PRODUÇÃO DO APP — INALTERADA
E7+ — NÃO INICIADAS
```
---

## 1. Princípios confirmados

| # | Princípio |
|---|---|
| P1 | Participante comercial ≠ Auth |
| P2 | `participant_id` nunca = `auth.uid()` |
| P3 | Multiempresa via `empresa_usuarios` |
| P4 | Parceiro comercial ≠ novo tenant |
| P5 | Franqueada / cliente SaaS = `empresas` |
| P6 | Org/imobiliária ≠ tipo de PF |
| P7–P10 | Financeiro, comissões, vendas, CRM completo adiados |
| P11–P13 | Sites: rota + subdomínio + domínio próprio; resolução domínio→tenant→site; `empresa_dominios` só tenant |
| P14 | Parceiro **não edita** o site; login = área comercial |
| **P15** | Área comercial com mutações no escopo da org; isolamento por vínculo + permissão |

---

## 2. Escopo oficial final consolidado

### 2.1 Incluído na Fase 3

#### A) Participantes comerciais
- Tipos MVP (múltiplos por vínculo×empresa): `GESTOR`, `CONSULTOR`, `VENDEDOR`, `ATENDENTE`, `INDICADOR`, `RESPONSAVEL_PARCEIRO`
- Status: `RASCUNHO`, `ATIVO`, `INATIVO`, `SUSPENSO`, `DESLIGADO`
- Login opcional (máx. 1 `usuario` por participante×empresa)
- Org opcional; N:N com org principal opcional
- Auditoria de status e vínculos
- Sem equipes/metas completas (Fase 16)

#### B) Organizações parceiras
- Tipos extensíveis: `PARCEIRO_COMERCIAL`, `IMOBILIARIA`, `CONTABILIDADE`, `CORRETORA_DE_SEGUROS`, `EMPRESA_DE_SERVICOS`, `ASSOCIACAO`, `INDICADOR_EMPRESARIAL`, `OUTRO`
- 1 org = 1 empresa tenant; PJ pode repetir em outro tenant como registro separado
- Status: `RASCUNHO`, `ATIVA`, `INATIVA`, `SUSPENSA`, `ENCERRADA`
- Só `ATIVA` publica site / recebe novos participantes ativos / novos leads-propostas vinculados
- Responsáveis = participantes; 1 responsável principal ativo
- Geo simples (cidade, estado, regiões)

#### C) Sites de parceiros (só empresa tenant)
Empresa controla: template, visual, textos, imagens, menus, domínio, DNS, Vercel, publicação, suspensão, arquivamento.

Canais do **mesmo** site: `/parceiro/[slug]`, `{slug}.gauchinhoconsorcios.com.br`, domínio próprio (apex+www+aliases).  
**MVP:** no máximo **um site principal ativo** por organização (schema 1:N preparado; regra de app + constraint segura).

#### D) Área comercial do parceiro (papel `parceiro_comercial`)
Mutações **dentro do escopo** da org:
- cadastrar/editar leads próprios; observações; status comerciais simples
- criar proposta; editar se `RASCUNHO`; visualizar/baixar; histórico válido básico

Mutações obrigam: `empresa_id`, `organizacao_parceira_id`, `participant_id` (se houver), `created_by_usuario_id` (ou equivalente).

#### E) Colunas estruturais em `leads` / `propostas` (nullable)
`empresa_id`, `organizacao_parceira_id`, `parceiro_site_id`, `participant_id`, `host_origem`, `pagina_origem`, `utm_source`, `utm_medium`, `utm_campaign`.

### 2.2 Fora da Fase 3 (Fase 6 / outras)

Kanban, distribuição automática, agenda, automações, campanhas, score, edição em massa, atribuição avançada, histórico avançado, dashboards CRM, comissões/repasses, wildcard DNS, editor do site pelo parceiro, remoção do fallback, operacionalizar Empresa B.

### 2.3 Decisões Q1–Q5 (encerradas)

| Q | Decisão |
|---|---|
| Q1 | Área comercial **não** é só leitura; mutações no escopo; CRM avançado = Fase 6 |
| Q2 | `RESPONSAVEL_PARCEIRO` vê toda a org; demais só vínculos próprios (+ permissão de visão ampliada); regra por vínculo+permissão |
| Q3 | Colunas nullable em `leads`/`propostas`; sem tabela 1:1; legado NULL; sem migrar CMS/`srd_responsavel_id` |
| Q4 | Papel novo `parceiro_comercial`; preservar `parceiro_imobiliaria`; permissões granulares de área; **sem** perms de site |
| Q5 | Máx. 1 site ativo por org no MVP; vários canais/domínios no mesmo site |

---

## 3. Visibilidade e permissões (área comercial)

| Ator | Leads/propostas | Observação |
|---|---|---|
| `RESPONSAVEL_PARCEIRO` | Toda a própria org | Sem outras orgs |
| Participante autorizado | Só vinculados a ele | + permissão `visao_ampliada_org` (conceitual) se concedida |
| `parceiro_comercial` | Conforme vínculos + perms | Nunca site/DNS/branding |
| Admin empresa / SuperAdmin | Tenant / plataforma | Admin, não “área parceiro” |

### 3.1 Matriz de permissões

| Capacidade | SuperAdmin | Admin empresa | `gerenciar_sites_parceiros` | `parceiro_comercial` |
|---|---|---|---|---|
| CRUD participantes / orgs | Sim | Sim | Não (salvo outra perm) | Não |
| Editor site / branding / menus | Sim | Sim | Sim | **Não** |
| Domínio / DNS / Vercel / publicar | Sim | Sim | Sim | **Não** |
| `acessar_area_parceiro` | — | — | — | Sim |
| `visualizar_leads_parceiro` | Tenant | Tenant | — | Escopo org/vínculo |
| `criar_leads_parceiro` / `editar_leads_parceiro` | Tenant | Tenant | — | Escopo próprio |
| `visualizar_propostas_parceiro` | Tenant | Tenant | — | Escopo org/vínculo |
| `criar_propostas_parceiro` / `editar_propostas_parceiro` | Tenant | Tenant | — | Escopo; edit só RASCUNHO |
| Leads gerais / outros parceiros | Sim | Sim | — | **Não** |
| Config tenant / usuários gerais | Sim | Sim | — | **Não** |
| Financeiro / comissões | Não nesta fase | Não | Não | **Não** |

Permissões conceituais a criar:  
`acessar_area_parceiro`, `visualizar_leads_parceiro`, `criar_leads_parceiro`, `editar_leads_parceiro`, `visualizar_propostas_parceiro`, `criar_propostas_parceiro`, `editar_propostas_parceiro`, `visao_ampliada_org_parceiro`, `gerenciar_sites_parceiros`, `gerenciar_organizacoes_parceiras`, `gerenciar_participantes`.

---

## 4. Schema conceitual

```
empresas
├── organizacoes_parceiras
│   ├── participante_organizacoes (N:N)
│   └── parceiro_sites          [≤1 ativo / org no MVP]
│       └── parceiro_site_dominios  (vários canais)
├── participantes_comerciais
│   ├── participante_tipos
│   └── (usuario_id 0..1 por empresa)
├── empresa_dominios            [Fase 2 — só tenant]
└── leads / propostas           [+ colunas estruturais nullable]
```

Status site: `RASCUNHO` \| `AGUARDANDO_APROVACAO` \| `PUBLICADO` \| `SUSPENSO` \| `ARQUIVADO`  
Status domínio: `PENDENTE_DNS` \| `VERIFICANDO` \| `ATIVO` \| `ERRO` \| `SUSPENSO` \| `REMOVIDO`  
SSL: `PENDING` \| `READY` \| `ERROR`

---

## 5. Limites Fase 3 × Fase 6

| Tema | Fase 3 | Fase 6 |
|---|---|---|
| Identidade participantes/orgs | Sim | Evolui |
| Login `parceiro_comercial` + perms | Sim | Evolui |
| Lista/detalhe + mutações simples | Sim | Funil completo |
| Colunas estruturais | Sim | Uso pleno |
| Kanban / distribuição / agenda / automações | Não | Sim |
| Score / campanhas / dashboards CRM | Não | Sim |
| Backfill massivo legado | Não (só se autorizado à parte) | Possível |

---

## 6. Plano técnico de implementação por etapas

> Executar **somente** após autorização explícita.

| Etapa | Conteúdo | Dependência |
|---|---|---|
| **E0** | Branch `feature/saas-fase-3`; checklist pré-voo (legado, Empresa B, fallback) | Auth |
| **E1** | Migration 045 (schema + papéis/perms + colunas leads/propostas + RLS helpers) | E0 |
| **E2** | Libs: participantes, orgs, contexto parceiro, isolation helpers | E1 |
| **E3** | Admin: participantes + organizações | E2 |
| **E4** | Admin: parceiro-sites (branding/menus) + preview | E3 |
| **E5** | Domínios parceiro + Vercel server-side + publicação (gates) | E4 |
| **E6** | Resolver runtime: path / subdomínio / domínio próprio | E5 |
| **E7** | Área comercial: leads/propostas no escopo + mutações Q1 | E2+E1 |
| **E8** | Site público `/parceiro/[slug]` + hosts | E6 |
| **E9** | Homologação staging/preview | E7+E8 |
| **E10** | Homologação produção (autorização separada) | E9 |

Ordem sugerida de merge: E1→E2→E3→E7 (valor comercial) em paralelo controlado com E4→E5→E6→E8 (sites).

---

## 7. Proposta de migration (não criar arquivo ainda)

**Nome candidato:** `045_participantes_organizacoes_parceiro_sites.sql`

### 7.1 Criar
- `organizacoes_parceiras` (+ auditoria se necessário)
- `participantes_comerciais`
- `participante_tipos` (ou tabela de atribuição de tipos)
- `participante_organizacoes`
- `participante_auditoria` (ou genérica)
- `parceiro_sites` + constraint/partial unique: no máx. 1 site **ativo/não arquivado** por `organizacao_parceira_id`
- `parceiro_site_dominios` + auditoria
- Funções helper: contexto de org do usuário, checks de escopo
- Seed: papel `parceiro_comercial` (escopo COMPANY) + permissões listadas em §3.1
- `papel_permissoes` para o novo papel (**sem** perms de site/DNS)

### 7.2 Alterar
- `leads` / `propostas`: adicionar colunas nullable §2.1.E + FKs + índices parciais  
  ex.: `WHERE organizacao_parceira_id IS NOT NULL`, `WHERE empresa_id IS NOT NULL`
- Policies RLS: SELECT/INSERT/UPDATE para área parceiro filtrando `empresa_id` + org; admin tenant inalterado em espírito

### 7.3 Não fazer na 045
- Drop/rename de `parceiro_imobiliaria`
- Migrar `parceiro_id` CMS → org
- Converter `srd_responsavel_id`
- Backfill massivo
- Wildcard / mudanças em `empresa_dominios` oficiais
- Tocar Empresa B operacionalmente

---

## 8. Estratégia de preservação do legado

| Ativo | Ação |
|---|---|
| Contagens operacionais Gauchinho | Não apagar/alterar em massa |
| `parceiros` CMS | Preservar; sem fusão automática |
| `imobiliarias` + papel `parceiro_imobiliaria` | Preservar fluxo atual |
| `leads.srd_responsavel_id` | Intactos; novos fluxos usam `participant_id` |
| `leads.parceiro_id` / `propostas.parceiro_id` | Intactos (CMS); novos usam `organizacao_parceira_id` |
| `empresa_dominios` / branding Fase 2 | Intactos |
| Fallback emergency / preview | Mantidos |
| Empresa B | Sem sites/orgs/participantes reais nesta fase |
| Domínios oficiais | Deny-list em fluxos de parceiro |

Backfill futuro: script separado, auditável, com autorização explícita.

---

## 9. Estratégia de testes e homologação

### 9.1 Critérios de homologação (atualizados)

| # | Critério |
|---|---|
| H1 | Participante sem login cadastrável |
| H2 | Tipos múltiplos por empresa |
| H3 | Org ATIVA necessária para site PUBLICADO |
| H4 | ≤1 site ativo por org; vários domínios no mesmo site |
| H5 | `parceiro_comercial` sem acesso a editor/DNS/Vercel |
| H6 | Responsável vê toda a org; demais só vínculos (+ visão ampliada se perm) |
| H7 | Mutações de lead/proposta gravam `empresa_id` + `organizacao_parceira_id` |
| H8 | Parceiro não lê/escreve fora da org |
| H9 | Legado com NULL nas novas colunas continua acessível ao admin legado |
| H10 | `parceiro_imobiliaria` segue funcionando |
| H11 | Host tenant intocável pelo fluxo parceiro |
| H12 | Sem wildcard; hosts explícitos |
| H13 | Empresa B / fallback / domínios oficiais inalterados |
| H14 | CMS `parceiros` preservado |
| H15 | Auditoria de status participante e domínio |

### 9.2 Roteiro de testes
1. Unit/integration: normalização host, gates de publicação, escopo org  
2. Preview Vercel: admin sites + área comercial com usuário `parceiro_comercial`  
3. Negativos: tentativa de editar site, ler outra org, criar lead sem `empresa_id`  
4. Regressão: login imobiliária, CRM admin atual, hosts oficiais  
5. Produção: só com autorização explícita pós-E9  

---

## 10. Riscos e rollback

| Risco | Severidade | Mitigação / rollback |
|---|---|---|
| Vazamento cross-org | Crítica | RLS + testes negativos; rollback: desativar rotas área parceiro |
| Policy RLS quebrar CRM legado | Alta | Policies aditivas; testar admin master/srd |
| Domínio tenant removido por engano | Crítica | Tabelas separadas + deny-list; rollback Vercel manual |
| Confusão CMS vs org | Alta | Campos novos; docs UI |
| Constraint 1 site ativo contornada | Média | Unique parcial + validação app |
| Escopo virar Fase 6 | Alta | Checklist de exclusões |
| Migration falhar em prod | Alta | Aplicar só após preview; rollback SQL preparado (drop novos objetos; manter colunas nullable se já houver dados) |

**Rollback de release app:** feature flags ou remoção de rotas `/area-parceiro` e admin sites sem dropar dados.  
**Rollback de domínios Vercel:** suspender site → marcar domínio `REMOVIDO` → DELETE API; nunca tocar `empresa_dominios`.

---

## 11. Arquivos previstos (quando autorizado)

### 11.1 Banco
- `supabase/migrations/045_participantes_organizacoes_parceiro_sites.sql`

### 11.2 Libs (sob `gauchinho-app/`)
- `src/lib/participantes/*`
- `src/lib/organizacoes-parceiras/*`
- `src/lib/parceiro-sites/*` (resolver, vercel-domains server)
- `src/lib/area-parceiro/*` (escopo, permissões)
- Helpers RLS já no SQL; client/server guards espelhando perms

### 11.3 Admin (empresa)
- `src/app/admin/participantes/**`
- `src/app/admin/organizacoes-parceiras/**`
- `src/app/admin/parceiro-sites/**`

### 11.4 Área comercial
- `src/app/area-parceiro/**` (leads, propostas, detalhe)

### 11.5 Público
- `src/app/parceiro/[slug]/**`
- Ajustes no proxy/resolver de host (arquivos atuais de tenant resolution)

### 11.6 Docs
- Este relatório (atualizar após cada etapa homologada)
- `docs/SAAS-MASTER-ARCHITECTURE.md` §5.1

**Não previstos nesta fase:** redesign CRM admin legado; jobs de backfill; wildcard Vercel.

---

## 12. Dúvidas bloqueantes

**Nenhuma.** Q1–Q5 encerradas.  
Detalhes de UX/copy/nomes de rota podem ser decididos na implementação sem reabrir escopo.

---

## 13. Registro da rodada E0–E3 (2026-08-06)

### 13.1 Pré-check git (estado real)

| Item | Valor |
|---|---|
| `origin/main` | `b3e6247` — homologação produção Fase 2 |
| `main` local antes da branch | ahead 1: `174108e` (encerra Fase 2 / abre plano Fase 3) — **não estava em origin** |
| Escopo final Fase 3 (Q1–Q5 + §5.1) | Alterações locais em `SAAS-MASTER` + este relatório (ainda não em origin) |
| Untracked fora do escopo | `.claude/`, `Adesivos/`, `.vercelignore`, `supabase/.temp/`, etc. — **não stageados** |
| Arquivo pedido `FASE-01-IMPLEMENTACAO-E-HOMOLOGACAO.md` | **Não existe**; equivalente: `FASE-01-FUNDACAO-SAAS-MULTIEMPRESA.md` + homologações 043 |
| Branch criada | `feature/saas-fase-3-participantes-parceiros` (a partir da main local) |
| Push | **Não realizado** |

### 13.2 Escopo aprovado vs entregue nesta rodada

| Escopo aprovado | Entregue E0–E3 |
|---|---|
| Participantes / orgs / sites schema | Sim (SQL arquivo) |
| Colunas nullable leads/propostas | Sim (SQL arquivo; sem backfill) |
| Papel `parceiro_comercial` + perms | Sim (SQL arquivo) |
| Libs + regras + testes | Sim |
| Admin list/create/status | Sim (flag off) |
| Site público / Vercel / área comercial | **Não** (fora da autorização) |

### 13.3 Migration 045

- Arquivo: `supabase/migrations/045_participantes_organizacoes_parceiro_sites.sql`
- **Não aplicada** no Supabase remoto
- Policies novas em `leads`/`propostas`: **adiadas** (CRM legado `leads_staff` / `propostas_staff` preservado; documentado no SQL)
- Trigger cruzado impede host em `empresa_dominios` ∩ `parceiro_site_dominios`

#### Matriz papel → permissão (seed 045)

| Permissão | super_admin | admin_empresa | parceiro_comercial | parceiro_imobiliaria |
|---|---|---|---|---|
| gerenciar_participantes | Sim | Sim | Não | (legado intacto) |
| gerenciar_organizacoes_parceiras | Sim | Sim | Não | — |
| gerenciar_sites_parceiros | Sim | Sim | **Não** | — |
| acessar_area_parceiro + CRUD leads/propostas parceiro | Sim | Sim | **Sim** | — |

### 13.4 Código criado

- `gauchinho-app/src/lib/parceiros/*` (constants, normalize, rules, types, authorization, schema-ready, area-contexto)
- `gauchinho-app/src/app/admin/participantes/*`
- `gauchinho-app/src/app/admin/organizacoes-parceiras/*`
- Testes: `rules.test.ts`, `constants.test.ts`
- **Sem** entrada no sidebar/menu
- Flag: `FASE3_ADMIN_PARTICIPANTES_ENABLED` (default `false`)

### 13.5 Testes e build

| Comando | Resultado |
|---|---|
| `npm test` | **400 passed** (87 files) |
| `npm run build` | **exit 0** |

### 13.6 Estratégia RLS leads/propostas (convivência)

| Camada | Estado |
|---|---|
| Policies atuais `leads_staff` / `propostas_staff` | Intactas |
| Colunas novas | Nullable; legado NULL |
| Policies área parceiro | **Adiadas** para migration posterior da Fase 3 |
| Isolamento app | `podeVerRegistroComercial` + helpers SQL já criados |

### 13.7 Riscos desta rodada

| Risco | Mitigação |
|---|---|
| Alguém aplicar 045 sem auth | Cabeçalho do SQL + este relatório |
| Admin chamar tabelas inexistentes | Flag + `isFase3ParticipantesSchemaReady` |
| Confundir CMS/imobiliaria | Papel novo; legado preservado no SQL |

### 13.8 Pendências (após auditoria/push)

1. Aplicar migration 045 (somente com autorização explícita)
2. E4–E6 sites/domínios/Vercel
3. E7 área comercial + policies leads/propostas seguras
4. E8 site público
5. Preview / merge — autorização separada

---

## 14. Auditoria + dry-run + push da branch (2026-08-06)

### 14.1 Commits auditados

| Hash | Conteúdo |
|---|---|
| `c6304f0` | docs escopo final + registro E0–E3 |
| `d7d951d` | Migration 045 |
| `65e0013` | libs + admin inicial |
| *(commit documental desta auditoria)* | §14 deste relatório |

Branch: `feature/saas-fase-3-participantes-parceiros`

Base inclui também `174108e` (encerra Fase 2 / abre plano Fase 3) ainda ausente de `origin/main`.

Documentos Fase 3 na branch (vs `origin/main`):

- `docs/relatorios-fases/FASE-03-IMPLEMENTACAO-E-HOMOLOGACAO.md` (novo)
- `docs/SAAS-MASTER-ARCHITECTURE.md` (§5.1 Fase 3)
- `docs/PLANO-EXECUCAO-FASES.md` (banner legado)
- `docs/relatorios-fases/FASE-02-IMPLEMENTACAO-E-HOMOLOGACAO.md` (via `174108e`)

Diff limpo: sem `.env`, tokens, credenciais, `.next`, configs Vercel de deploy.

### 14.2 Auditoria remota (somente leitura)

| Verificação | Resultado |
|---|---|
| Migrations remote 001–044 | Presentes e alinhadas ao local |
| Migration 045 remote | **Ausente** |
| Tabelas novas (participantes/orgs/sites) | **Inexistentes** remotamente |
| Perms/papel novos | **Inexistentes**; `parceiro_imobiliaria` **existe** (legado) |
| `leads.empresa_id` / colunas Fase 3 | **Ainda não existem** |
| Policies leads/propostas | `leads_staff` (`is_staff()`), `propostas_staff` — **intactas** |
| Funções 043/044 | `set_updated_at`, `normalize_empresa_dominio_valor`, helpers SaaS OK |
| Índice `papeis_codigo_sistema_idx` | Compatível com ON CONFLICT da 045 |
| Contagens legado | leads 116, propostas 12, imobiliarias 1, parceiros CMS 3 |

### 14.3 Integridade da 045 (revisão do SQL)

| Tema | Status |
|---|---|
| `usuario_id` → `usuarios.id` (não auth.uid) | OK |
| Gestor mesma empresa (trigger) | OK |
| Tipos N + catálogo | OK |
| Login opcional + unique ATIVO (empresa, usuario) | OK |
| CPF unique por empresa (não global) | OK |
| Auditoria ON DELETE RESTRICT | OK |
| CNPJ unique por tenant | OK |
| Responsável principal único | OK |
| ≤1 site ativo/org; slug único/empresa | OK |
| Domínios separados + conflito cruzado | OK |
| Sem chamada Vercel na migration | OK |
| Leads/propostas nullable SET NULL; sem backfill | OK |
| Policies leads não alteradas | OK (adiadas) |
| SECURITY DEFINER + search_path=public | OK (5 helpers) |

Não é homologação funcional de banco — 045 não foi aplicada.

### 14.4 RLS / grants (novas tabelas — planejado na 045)

SECURITY DEFINER (todas com `SET search_path = public`; EXECUTE a authenticated/service_role; revoke public):

- `current_participante_id(uuid)`
- `participante_organizacoes_ativas(uuid)`
- `has_organizacao_acesso(uuid, uuid)`
- `is_responsavel_principal_org(uuid, uuid)`
- `assert_same_empresa_parceiro(uuid, uuid, uuid, uuid)`

Grants tabelas novas: authenticated SELECT/INSERT/UPDATE/DELETE; service_role ALL; anon REVOKE ALL.

Write sites/domínios: só super_admin ou `gerenciar_sites_parceiros` — `parceiro_comercial` não recebe essa permissão no seed.

### 14.5 Teste em banco descartável

**Não realizado.** Docker/Podman indisponível (`supabase status` → docker not found). Migration auditada estaticamente + dry-run remoto; não executada em sandbox.

### 14.6 Dry-run remoto

```
supabase migration list --linked  → 001–044 local=remote; 045 local only
supabase db push --linked --dry-run → Would push only:
  045_participantes_organizacoes_parceiro_sites.sql
```

Nenhum repair; nenhuma migration desconhecida; somente 045 pendente.

### 14.7 Push

- `git push -u origin feature/saas-fase-3-participantes-parceiros`
- Sem push de main
- Sem aplicar 045

### 14.8 Garantias pós-rodada

| Item | Estado |
|---|---|
| E0–E3 | Concluídos (código + branch remota) |
| Migration 045 | Criada; **não aplicada** |
| Banco remoto | Intacto (dry-run only) |
| Produção / Vercel / DNS | Intactos |
| Flag admin | false; rotas fora do menu |
| Empresa B / fallback | Intactos |
| E4 | Concluída em rodada posterior (ver §18); à época ainda não iniciada |
| Homologação funcional DB | **Não declarada** (à época; ver §16) |

---

## 16. Aplicação e homologação da Migration 045 (2026-08-06)

### 16.1 Comando e resultado

| Item | Valor |
|---|---|
| Branch | `feature/saas-fase-3-participantes-parceiros` |
| HEAD | `6c92a541595501066788f91f821c412b493535ea` |
| Projeto Supabase | `eaeuoynprurmmulzhydt` (Gauchinho-Site) |
| Comando | `supabase db push --linked --yes` |
| Início | 2026-08-06T17:09:41-04:00 |
| Fim | 2026-08-06T17:10:13-04:00 |
| Resultado | Aplicada **exclusivamente** `045_participantes_organizacoes_parceiro_sites.sql` |
| Exit | 0 |

### 16.2 Histórico e dry-run pós-apply

| Check | Resultado |
|---|---|
| `migration list --linked` | 001–045 local = remote |
| `db push --linked --dry-run` | **Remote database is up to date** |
| Migrations pendentes | Nenhuma |

### 16.3 Contagens antes / depois

| Entidade | Antes | Depois | Esperado |
|---|---:|---:|---|
| usuarios | 7 | 7 | 7 |
| empresa_usuarios | 7 | 7 | 7 |
| empresas | 2 | 2 | 2 |
| papeis | 6 | 7 (+`parceiro_comercial`) | +1 |
| permissoes | 10 | 20 (+10 Fase 3) | +10 |
| leads | 116 | 116 | 116 |
| propostas | 12 | 12 | 12 |
| imobiliarias | 1 | 1 | 1 |
| parceiros CMS | 3 | 3 | 3 |
| empresa_dominios | 1 | 1 | 1 |
| empresa_branding | 2 | 2 | 2 |

Leads/propostas: 100% dos registros com novos campos `NULL` (116/116 e 12/12). `srd_responsavel_id` preenchido em 53 leads (inalterado).

### 16.4 Estrutura criada

Tabelas: `participantes_comerciais`, `participante_tipo_catalogo`, `participante_tipos`, `participante_organizacoes`, `participante_auditoria`, `organizacoes_parceiras`, `parceiro_sites`, `parceiro_site_dominios`, `parceiro_site_auditoria`.

Colunas nullable em `leads` e `propostas`: `empresa_id`, `organizacao_parceira_id`, `parceiro_site_id`, `participant_id`, `host_origem`, `pagina_origem`, `utm_*`.

RLS ativada nas tabelas novas (policies select/write conforme seed). CRM: `leads_staff` / `propostas_staff` (`is_staff()`) **intactas** — sem policies novas de área parceiro em leads/propostas.

### 16.5 Testes transacionais com ROLLBACK

Script em DO $$ … RAISE HOMOLOG_OK:…; $$ — todos OK, zero linhas persistidas:

`OK_MULTI_TIPOS; OK_GESTOR_CROSS; OK_DUP_USER; OK_USER_OTHER_EMP; OK_DUP_CNPJ; OK_CNPJ_OTHER_TENANT; OK_CROSS_LINK; OK_SECOND_RESP; OK_SECOND_SITE; OK_DUP_SLUG; OK_TENANT_HOST; OK_SECOND_PRIMARY; OK_DUP_DOMAIN; OK_EMP_DOM_CONFLICT; OK_DELETE_AUDIT`

Contagem pós-teste: participantes/orgs/sites/domínios = **0**.

### 16.6 RLS e permissões

SECURITY DEFINER (search_path=public): `current_participante_id`, `participante_organizacoes_ativas`, `has_organizacao_acesso`, `is_responsavel_principal_org`, `assert_same_empresa_parceiro`.

`parceiro_comercial` permissões: somente área comercial (7). **0** permissões `gerenciar_*` / site / tenant.

`parceiro_imobiliaria` preservado. `admin_empresa` recebe as 4 permissões de gestão/área Fase 3 verificadas.

### 16.7 Código / ops

| Item | Estado |
|---|---|
| `npm test` | 400 passed |
| `npm run build` | exit 0 |
| Flag | `FASE3_ADMIN_PARTICIPANTES_ENABLED` false |
| Menu | rotas fora do sidebar |
| Deploy / preview / Vercel / DNS | **Não** |
| Merge main | **Não** |
| Empresa B / fallback | Intactos |
| E4 admin sites | **Implementada nesta rodada** (ver §18) |

### 16.8 Riscos / divergências

Nenhuma divergência de contagens legadas. Policies CRM de área parceiro **continuam adiadas** (etapa posterior). Fase 3 **não** está concluída.

---

## 17. Próximo passo (histórico pré-E4)

Autorizada e executada: E4 (admin sites, cadastro local de domínios). Próximas rodadas: E5 (Vercel/DNS real) e/ou E7 (área comercial + policies leads/propostas), sob nova autorização. Manter flags off e sem preview até autorização.

---

## 18. Registro da rodada E4 — Admin de sites de parceiros (2026-08-07)

### 18.1 Escopo entregue

| Item | Estado |
|---|---|
| Rotas `/admin/parceiro-sites`, `/novo`, `/[id]` | **Feito** (flag off; fora do menu) |
| Listagem + filtros (org, status, template, domínio, publicado, busca) | **Feito** |
| Criação só org ATIVA do tenant; ≤1 site ativo; slug único no tenant | **Feito** |
| Edição admin (template, branding, menus, SEO, status) | **Feito** |
| Template controlado `institucional_v1` (sem page builder / HTML arbitrário) | **Feito** |
| Catálogo de menus allowlist | **Feito** |
| Domínios: cadastro local apenas → `PENDENTE_DNS` / SSL `PENDING` | **Feito** |
| Auditoria `parceiro_site_auditoria` | **Feito** |
| Permissões: `super_admin` / `admin_empresa` / `gerenciar_sites_parceiros`; deny `parceiro_comercial` | **Feito** (UI + Server Actions) |

### 18.2 Explicitamente NÃO feito nesta rodada

- API Vercel / verificação DNS / SSL real / marcar domínio ATIVO por simulação
- Rota pública `/parceiro/[slug]` ou resolução por host
- `FASE3_PARCEIRO_PUBLIC_SITE_ENABLED` / `FASE3_PARCEIRO_AREA_ENABLED`
- Área comercial; policies novas em leads/propostas
- Deploy, preview, merge main, alteração de produção
- Empresa B operacional; remoção do fallback; Fase 4

### 18.3 Flags

| Flag | Default | Uso nesta rodada |
|---|---|---|
| `FASE3_ADMIN_PARTICIPANTES_ENABLED` | `false` | Mantida |
| `FASE3_PARCEIRO_SITES_ADMIN_ENABLED` | `false` | Admin sites (E4) — off |
| `FASE3_PARCEIRO_PUBLIC_SITE_ENABLED` | `false` | Futura (E8) — off |
| `FASE3_PARCEIRO_AREA_ENABLED` | `false` | Futura (E7) — off |

Constante de código: `VERCEL_INTEGRATION_ENABLED_IN_E4 = false` (nenhum request Vercel).

### 18.4 Testes e build

| Check | Resultado |
|---|---|
| `npm test` | **414 passed** (89 files), exit 0 |
| `npm run build` | **exit 0** |
| Cobertura E4 (libs + actions) | criação/org suspensa/outro tenant/2º site/slug/menus/branding/domínio oficial e duplicado/`PENDENTE_DNS`/sem Vercel/auditoria/`parceiro_comercial`/service role fora do client |

### 18.5 Banco e produção

| Item | Estado |
|---|---|
| Migration 045 | Já homologada (§16); **sem nova migration** |
| 001–045 local = remote | Mantido |
| Produção app | **Inalterada** |
| Vercel / DNS | **Intactos** |
| Empresa B / fallback | **Intactos** |

### 18.6 Git

| Item | Estado |
|---|---|
| Branch | `feature/saas-fase-3-participantes-parceiros` |
| Base documental remota | `7aea490` (push autorizado) |
| Commit E4 | Local — `feat(saas): adiciona administracao de sites de parceiros` |
| Push E4 | **Não** (aguarda nova autorização) |
| Merge main | **Não** |

### 18.7 Arquivos principais

- `gauchinho-app/src/lib/parceiros/{templates,menus,branding,site-rules}.ts` (+ testes)
- `gauchinho-app/src/app/admin/parceiro-sites/**`
- Flags/constants/`schema-ready`/`types`/`index`

---


## 19. Registro da rodada E5 — Domínios + Vercel + gates (2026-08-07)

### 19.1 Push E4

| Item | Valor |
|---|---|
| Branch | `feature/saas-fase-3-participantes-parceiros` |
| Commit | `9e2bc12` — feat(saas): adiciona administracao de sites de parceiros |
| Push | `git push origin feature/saas-fase-3-participantes-parceiros` |
| Local = remote | **Sim** (`HEAD` = `origin/...` = `9e2bc12`) |
| Merge main | **Não** |

### 19.2 Escopo E5 entregue

| Item | Estado |
|---|---|
| Módulo `vercel-domains.server.ts` (`import "server-only"`) | **Feito** |
| Projeto Vercel | `hugo-8097s-projects/guachinho-site` (mesmo projeto; sem criar outro) |
| Add / get / config DNS / remove / reconcile | **Feito** (API oficial; idempotente; mockável) |
| Deny-list `empresa_dominios` (inclui oficiais Gauchinho) | **Feito** (server-side) |
| Apex + www como conjunto; principal apex/www | **Feito** (valor local = apex) |
| Subdomínio `{slug}.gauchinhoconsorcios.com.br` + labels reservados | **Feito** |
| Verificar / reconciliar / suspender / remover | **Feito** |
| Gates de publicação (org/site/branding/menus/domínio/SSL) | **Feito** |
| UI `/admin/parceiro-sites/[id]` seção DOMÍNIO DO PARCEIRO | **Feito** |
| Auditoria de eventos de domínio/publicação | **Feito** |

### 19.3 Explicitamente NÃO feito

- Nenhum domínio real adicionado à Vercel
- Nenhum DNS real alterado
- Flag `FASE3_VERCEL_DOMAINS_ENABLED` permanece **false**
- Site público E8 / resolver E6 completo / área comercial E7
- Policies novas leads/propostas
- Preview, deploy, merge main, Empresa B, remoção do fallback, Fase 4

### 19.4 Flags

| Flag | Default |
|---|---|
| `FASE3_PARCEIRO_SITES_ADMIN_ENABLED` | `false` |
| `FASE3_VERCEL_DOMAINS_ENABLED` | `false` |
| `FASE3_PARCEIRO_PUBLIC_SITE_ENABLED` | `false` |
| `FASE3_PARCEIRO_AREA_ENABLED` | `false` |

Integração exige: flag Vercel + `VERCEL_API_TOKEN`/`VERCEL_TOKEN` + projeto (`VERCEL_PROJECT_ID` ou default documentado). Token nunca `NEXT_PUBLIC_`, nunca client bundle, nunca log.

### 19.5 Testes e build

| Check | Resultado |
|---|---|
| `npm test` | **441 passed** (92 files), exit 0 |
| `npm run build` | **exit 0** |
| Token/Vercel module em `.next/static` | **Ausentes** |
| Service role no client bundle (actions E5) | **Ausente** |

### 19.6 Git E5

| Item | Estado |
|---|---|
| Commit local | `feat(saas): integra dominios de parceiros com Vercel` |
| Push E5 | **Não** (aguarda autorização) |

### 19.7 Próximo passo sugerido

**E6** — resolver runtime path/subdomínio/domínio próprio (sem publicar ainda), ou homologação controlada da integração Vercel em ambiente não-produtivo com domínio de teste — sob nova autorização.

---


## 20. Registro da rodada E6 — Resolver runtime (2026-08-07)

### 20.1 Push E5

| Item | Valor |
|---|---|
| Branch | `feature/saas-fase-3-participantes-parceiros` |
| Commit | `0e87dfa` — feat(saas): integra dominios de parceiros com Vercel |
| Local = remote pós-push | **Sim** |
| Merge main | **Não** |

### 20.2 Escopo E6 entregue

| Item | Estado |
|---|---|
| `PartnerSiteResolution` + sources `parceiro_path` / `parceiro_subdomain` / `parceiro_domain` | **Feito** |
| Ordem A–G documentada (`PARTNER_RESOLUTION_ORDER`) | **Feito** |
| Resolver puro `resolvePartnerSiteFromFacts` (injetável / testável) | **Feito** |
| Canonical helpers (sem redirect público) | **Feito** |
| Preview admin autenticado na ficha do site | **Feito** |
| Proxy: strip headers `x-parceiro-*` do cliente; sem servir público | **Feito** |
| Isolamento multi-tenant + ignore query forçada | **Feito** |

### 20.3 Ordem de resolução

1. **A** normalizar Host  
2. **B** lookup `empresa_dominios`  
3. **C** host tenant + `/parceiro/[slug]` → site por `empresa_id+slug`  
4. **D** host em `parceiro_site_dominios` (não REMOVIDO) → tenant=`empresa_id` do domínio  
5. **E** host só institucional → sem parceiro  
6. **F** fallbacks Fase 2 (módulo tenant intacto)  
7. **G** desconhecido → sem parceiro  

Nunca resolve parceiro antes de confirmar `empresa_id` (path exige tenant; domínio usa `empresa_id` persistido).  
`vercel_preview_gauchinho` **nunca** é source de domínio próprio de parceiro.

### 20.4 Flags / comportamento público

| Flag | Default | Efeito E6 |
|---|---|---|
| `FASE3_PARCEIRO_PUBLIC_SITE_ENABLED` | `false` | Resolver identifica; **não serve** site público |
| `FASE3_VERCEL_DOMAINS_ENABLED` | `false` | Zero chamadas Vercel |
| Demais flags Fase 3 | `false` | Mantidas |

Nenhuma rota pública `/parceiro/[slug]` criada. Nenhuma UX pública substituída.

### 20.5 Regressão Fase 2

Resolver de tenant (`resolveTenantForRequest`), cache, preview Vercel seguro, fallback oficial, `empresa_dominios` e proxy operacional **inalterados em comportamento**. E6 é aditiva.

### 20.6 Testes e build

| Check | Resultado |
|---|---|
| `npm test` | **464 passed** (93 files), exit 0 |
| `npm run build` | **exit 0** |
| Site publicado por E6 | **Não** |

### 20.7 Git E6

| Item | Estado |
|---|---|
| Commit local | `feat(saas): adiciona resolucao runtime de sites parceiros` |
| Push E6 | **Não** (aguarda autorização) |

### 20.8 Próximo passo sugerido

**E8** (site público atrás da flag) após homologação do resolver, **ou E7** (área comercial) — rodadas separadas.

---

## STATUS FINAL DESTA RODADA

```
FASE 3 — MIGRATION 045 APLICADA E BANCO HOMOLOGADO
E0–E6 — IMPLEMENTADOS
PUSH E5 0e87dfa — REMOTO SINCRONIZADO
RESOLVER RUNTIME — IMPLEMENTADO (FLAG PÚBLICA OFF)
NENHUM SITE PUBLICADO
VERCEL/DNS REAIS — INTOCADOS
ÁREA COMERCIAL — NÃO IMPLEMENTADA
COMMIT E6 — LOCAL (SEM PUSH)
PRODUÇÃO DO APP — INALTERADA
E7+ — AGUARDA AUTORIZAÇÃO
```
