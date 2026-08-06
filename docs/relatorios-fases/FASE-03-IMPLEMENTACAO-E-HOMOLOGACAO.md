# FASE 3 SaaS — Escopo oficial final + plano técnico (documental)

**Título:** Participantes Comerciais e Sites de Parceiros  
**Fonte canônica:** `docs/SAAS-MASTER-ARCHITECTURE.md` §5 e §5.1  
**Roadmap legado (não numera SaaS):** `docs/PLANO-EXECUCAO-FASES.md`  
**Data:** 2026-08-06  

> **Autorização atual:** E0–E3 (branch, arquivo migration 045, libs, admin inicial).  
> **Não autorizado nesta rodada:** aplicar 045 no Supabase, banco remoto, Vercel/DNS, site público, área comercial, preview/prod deploy, push, merge main, fallback, Empresa B, Fase 4/6.

---

## Matriz de governança

| Dimensão | Status |
|---|---|
| Título Fase 3 | **Confirmado** |
| Princípios P1–P15 | **Confirmados** |
| Blocos A/B + sites/domínios + Q1–Q5 | **Confirmados** |
| Escopo oficial | **FINAL** |
| E0 branch | **Feito** `feature/saas-fase-3-participantes-parceiros` |
| E1 migration 045 (arquivo) | **Criada — NÃO aplicada** |
| E2 libs | **Feito** |
| E3 admin participantes/orgs | **Feito** (flag off; fora do menu) |
| E4–E10 | **Não iniciados** |
| Banco remoto / Vercel / DNS / deploy / push | **Intocados** |

---

## STATUS

```
FASE 3 — E0–E3 IMPLEMENTADOS LOCALMENTE
MIGRATION 045 — ARQUIVO CRIADO / NÃO APLICADA
FLAG FASE3_ADMIN_PARTICIPANTES_ENABLED — false (padrão)
BANCO REMOTO / VERCEL / DNS / DEPLOY / PUSH — INTOCADOS
EMPRESA B / FALLBACK — INTOCADOS
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

### 13.8 Pendências (próxima autorização)

1. Aplicar migration 045 (ambiente isolado/homologação)  
2. E4–E6 sites/domínios/Vercel  
3. E7 área comercial + policies leads/propostas seguras  
4. E8 site público  
5. Push da branch / preview  

### 13.9 Garantias

- Nada aplicado no banco remoto  
- Nada deployado / push  
- Vercel/DNS intocados  
- Empresa B intocada  
- Fallback mantido  

---

## 14. Próximo passo

Aguardar autorização explícita para **aplicar 045** (homologação) e/ou iniciar **E4+**.

---

## STATUS FINAL DESTA RODADA

```
E0–E3 — CONCLUÍDOS LOCALMENTE
MIGRATION 045 — CRIADA / NÃO APLICADA
TESTES 400 PASS / BUILD OK
PUSH / DEPLOY / BANCO REMOTO / VERCEL / DNS — NÃO
AGUARDANDO NOVA AUTORIZAÇÃO
```