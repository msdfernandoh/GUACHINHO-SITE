# FASE 4 SaaS — Catálogo Global de Administradoras

**Título:** Catálogo Global de Administradoras  
**Fonte canônica:** `docs/SAAS-MASTER-ARCHITECTURE.md`  
**Data E0:** 2026-08-08  
**Data E1:** 2026-08-08  
**Branch:** `feature/saas-fase-4-catalogo-administradoras`  
**Base main:** `7eb7b4bb7c2bb4b69a9e13b66b92de2fc617e121`  
**E0 remoto:** `d6ec92792bc43d9e78e84de2858db457435f799c`

> **Autorização E1:** fundação estrutural local (migration 047) + auditoria/dry-run/testes/docs/commits locais.  
> **Proibido nesta rodada:** apply remoto da 047, push E1, E2, deploy, preview, Fase 5, concessão Empresa B, backfill de grupos.

---

## 1. Objetivo

Criar a fundação do **catálogo global de administradoras** (ex.: Racon), com concessão exclusiva pelo `PLATFORM_SUPERADMIN` via vínculo `empresa × administradora`, preservando o legado Gauchinho e a confidencialidade comercial entre tenants.

---

## 2. Decisões de negócio (confirmadas)

| # | Decisão |
|---|---|
| D1 | Administradora é entidade **GLOBAL** da plataforma |
| D2 | Tenant **não escolhe** administradoras; não há marketplace |
| D3 | Concessão só por `PLATFORM_SUPERADMIN` |
| D4 | Tenant só vê administradoras **vinculadas e ativas** à própria empresa |
| D5 | Comissões/repasses **não** ficam no catálogo global |
| D6 | Fase 3 (parceiros) permanece intacta |
| D7 | Empresa B permanece `em_treinamento` sem concessão nesta E0 |
| D8 | Relacionamentos estruturais futuros por **UUID/FK**, não por texto |

---

## 3. Confidencialidade (requisito estrutural)

Uma empresa sem autorização para determinada administradora **não pode**:

- listar, pesquisar, resolver por UUID/slug;
- obter logo/nome/modalidades/grupos/metadata;
- inferir existência via erro diferenciado;
- consumir API que exponha o catálogo global.

`PLATFORM_SUPERADMIN` vê o catálogo completo.  
Não basta esconder no frontend — RLS + helpers + APIs.

---

## 4. Estado legado (achado crítico da E0)

### 4.1 Não existe tabela `administradoras`

O banco **não possui** `public.administradoras` nem `empresa_administradoras`.

Administradora hoje é **campo texto** em:

| Tabela | Coluna | Tipo |
|---|---|---|
| `grupos_consorcio` | `administradora` | `text` (nullable) |
| `cartas_contempladas` | `administradora` | `text` |
| `contratacoes_online` | `administradora` | `text` (snapshot) |

### 4.2 Valores distintos encontrados (Gauchinho)

| Valor texto | Grupos | Cotas (opções) | Cartas | Contratações |
|---|---:|---:|---:|---:|
| `RACON` | 16 | 158 | 4 | 14 |
| `Racon` | 3 | 20 | 0 | 4 |

**Risco:** inconsistência de casing (`RACON` vs `Racon`) — na prática é a **mesma** administradora; futura migration deve normalizar para **um UUID**.

Nenhuma outra administradora (Rodobens, Ademicon, etc.) encontrada nos dados atuais.

### 4.3 Contagens

| Entidade | Qtd |
|---|---:|
| `grupos_consorcio` | 19 |
| `grupos_cotas` | 178 |
| `propostas` | 16 |
| `contratacoes_online` | 18 |
| `cartas_contempladas` | 4 |
| `empresas` | 2 (Gauchinho ativo + Empresa B em treinamento) |
| Tabela `vendas` | **não existe** |

### 4.4 `grupos_cotas`

Representa **opções comerciais / créditos ofertados** do grupo (não cota definitiva de cliente).

- PK: `uuid`
- FK: `grupo_id → grupos_consorcio.id` (`ON DELETE CASCADE`)
- Campos: `valor_credito`, parcelas, `vagas_*`, `status`, `ativo`, `ordem`
- Sem `administradora` própria (herda do grupo via texto)

### 4.5 `grupos_consorcio`

- PK: `uuid` (já correto)
- **Sem** `empresa_id` — catálogo de grupos é global na prática
- `administradora` texto livre (input admin)
- Status legado: `Disponível` / `Verificar Disponibilidade` / `Inativo` (+ flag `ativo`)

### 4.6 UUIDs vs texto

| Relacionamento | Situação |
|---|---|
| `grupos_cotas.grupo_id` | UUID/FK ✅ |
| `grupos_modalidades_lance.grupo_id` | UUID/FK ✅ |
| `contratacoes_online.grupo_id` | UUID/FK ✅ (nullable) |
| `simulacoes_grupos_itens.grupo_id` / `grupo_cota_id` | UUID/FK ✅ |
| `administradora` em grupos/cartas/contratações | **texto** ❌ |
| `contratacoes_online.cota_id` | **text** (não FK) |
| `propostas` → grupo/cota | via `dados_simulacao` JSON (snapshots), sem FK administradora |

---

## 5. Auditoria de RLS

| Tabela | RLS | Policies relevantes | Exposição atual |
|---|---|---|---|
| `grupos_consorcio` | on | `grupos_public_read` (anon+auth: ativo e status≠Inativo); `grupos_staff_write` (`is_staff`) | **Catálogo público global** |
| `grupos_cotas` | on | `cotas_public_read` (via grupo ativo); staff write | Público |
| `grupos_modalidades_lance` | on | select public `true` | Público |
| `cartas_contempladas` | on | public read por status | Público (com filtro status) |
| `contratacoes_online` | on | staff por `usuarios.perfil` legado | Staff |
| `propostas` | on | staff + parceiro (Fase 3) | Escopo comercial |
| `empresas` | on | superadmin / member | SaaS |

**Conclusão:** hoje qualquer anon/authenticated autorizado pelas policies de grupos vê **todos** os grupos ativos, independentemente de tenant/administradora. Isso conflita com a confidencialidade da Fase 4 e precisará de redesenho controlado (sem quebrar o site público Gauchinho).

---

## 6. Auditoria de permissões / papéis

Papéis existentes: `super_admin` (PLATFORM), `admin_empresa`, `gestor`, `consultor`, `parceiro_comercial`, `parceiro_imobiliaria`, `visualizador`.

Permissões próximas: `gerenciar_grupos`, `gerenciar_empresas_plataforma`, `gerenciar_empresa_atual`, `gerenciar_site_empresa`.

**Não existe** permissão de catálogo de administradoras.

Proposta (criar só na implementação):

| Código | Quem recebe |
|---|---|
| `gerenciar_catalogo_administradoras` | somente `super_admin` |
| `gerenciar_administradoras_empresa` | somente `super_admin` |

`admin_empresa` **não** recebe essas permissões.

---

## 7. Fluxo atual `/admin/empresas`

- Gate: `isPlatformSuperadmin()` (redirect se não).
- Lista tenants; detalhe por id.
- Ações: status, branding, domínios (criar/verificar/remover).
- **Não há** criação de empresa na UI atual (somente gestão do que já existe).
- **Não há** seção de administradoras autorizadas.

**Encaixe futuro (E4):** no detalhe da empresa (`/admin/empresas/[id]`), bloco “Administradoras autorizadas” gerenciado só por Superadmin (conceder / suspender / configurar parâmetros do vínculo). Onboarding futuro: criar empresa + vínculos na mesma operação.

---

## 8. APIs / rotas que expõem catálogo

| Rota / superfície | Classificação | Risco Fase 4 |
|---|---|---|
| `GET` páginas `/grupos`, simulador | lê `grupos_consorcio` | Expõe admin via texto no payload |
| `/api/public/grupos/fluxo` | service role + UUIDs de grupo/cota | C (usa texto admin do grupo) |
| `/api/integration/grupos` | lista grupos + `administradora` | **Aberto ao catálogo** |
| `/api/public/cartas/interesse` | snapshot `administradora` | Snapshot |
| `/admin/grupos` + actions | CRUD com input texto `administradora` | D (hardcoded seed `"Racon"` em trecho) |
| PDF / contratação | display snapshot | E/C |

Classificação pedida:

- **A** UUID/FK correto: vínculos grupo↔cota↔simulação↔contratação.grupo_id  
- **B** ID numérico: não dominante  
- **C** nome/texto: `administradora` em grupos/cartas/contratações  
- **D** hardcoded: seed/admin actions com `"Racon"`  
- **E** legado sem relação: propostas sem FK de administradora  
- **F** risco migration: casing `RACON`/`Racon`; RLS pública global; ausência de `empresa_id` em grupos

---

## 9. Modelo proposto (conceitual — sem migration)

### 9.1 `administradoras` (global)

| Aspecto | Proposta |
|---|---|
| Finalidade | Catálogo único da plataforma |
| PK | `id uuid` |
| Campos sugeridos | `nome`, `nome_fantasia`, `razao_social`, `cnpj`, `slug` UK, `logo_url`, `site_url`, `status` (`ATIVA`/`INATIVA`), `modalidades_suportadas jsonb`, `recursos_integracao jsonb`, `metadata jsonb`, timestamps, `created_by_usuario_id` |
| Unique | `slug`; opcional `cnpj` quando preenchido |
| Delete | **soft** via status; sem cascade em dados comerciais |
| RLS | SELECT/WRITE apenas `is_platform_superadmin()`; tenants **nunca** leem direto |
| Auditoria | `audit_logs` existente (+ eventos específicos) |

### 9.2 `empresa_administradoras` (concessão)

| Aspecto | Proposta |
|---|---|
| Finalidade | Autorização Superadmin empresa×administradora |
| PK | `id uuid` |
| FKs | `empresa_id → empresas`, `administradora_id → administradoras` |
| Unique | `(empresa_id, administradora_id)` |
| Status vínculo | `ATIVA` / `INATIVA` / `SUSPENSA` |
| Campos locais (faseada) | `codigo_franquia`, `codigo_comercial`, `contato_interno`, `observacoes`, `configuracoes jsonb` (credenciais futuras criptografadas — **não** nesta E0) |
| RLS | Superadmin full; tenant SELECT só do próprio `empresa_id` **e** status ATIVA (+ admin global ATIVA) |
| Delete | soft status; histórico preservado |

### 9.3 Alterações aditivas futuras em `grupos_consorcio`

- Adicionar `administradora_id uuid NULL REFERENCES administradoras(id)`  
- Manter `administradora text` como **snapshot/display** durante transição  
- Backfill: normalizar `RACON`/`Racon` → um registro global  
- Depois: leituras passam a filtrar por concessão da empresa do tenant (e regras públicas do tenant principal)

### 9.4 Desativação em dois níveis

| Nível | Efeito |
|---|---|
| Admin global `INATIVA` | Nenhum tenant gera **novos** negócios com ela; histórico intacto |
| Vínculo `INATIVA`/`SUSPENSA` | Afeta só aquela empresa; outras franquias intactas |

---

## 10. Relacionamento com grupos — decisão recomendada

**Recomendação: Opção A — grupos globais da administradora + disponibilidade por empresa via concessão.**

Motivos alinhados ao legado:

1. Hoje grupos **já são globais** (sem `empresa_id`).
2. Gauchinho é o único operador real de Racon no dado.
3. Fase 4 entrega fundação de catálogo + concessão; Fase 5 evolui opções/grupos.
4. Se no futuro grupos divergirem por franquia, adicionar `empresa_grupo_disponibilidade` (Fase 5+) sem reescrever o catálogo global.

Opção B (grupos no contexto `empresa_administradora`) exigiria copiar/duplicar 19 grupos e 178 opções — alto risco e desnecessário agora.

---

## 11. Estratégia de migração do legado (futura E1/E5)

1. Criar `administradoras` + seed **Racon** (UUID novo).  
2. Criar `empresa_administradoras` vinculando **somente Gauchinho → Racon (ATIVA)**.  
3. **Não** vincular Empresa B.  
4. Adicionar `grupos_consorcio.administradora_id` nullable; backfill a partir do texto normalizado.  
5. Manter coluna texto até adapters/código migrarem.  
6. Adaptar APIs públicas do tenant Gauchinho para continuar funcionando (mesmo conteúdo).  
7. Impedir que Empresa B (ou futuros tenants) leiam grupos/admin não concedidos.  
8. Snapshots em contratação/PDF permanecem texto/JSON.

---

## 12. Estratégia de confidencialidade (implementação futura)

1. Helpers: `listAdministradorasAutorizadas(empresaId)`, `assertEmpresaPodeUsarAdministradora(...)`.  
2. RLS em `administradoras` fechada ao superadmin; leitura tenant só via view/RPC filtrada **ou** somente através de joins a partir de `empresa_administradoras`.  
3. Redesign gradual de `grupos_public_read` para escopo tenant (sem quebrar Gauchinho).  
4. `/api/integration/grupos` e listagens admin devem respeitar concessão.  
5. Erros uniformes (404) para UUID/slug não autorizados.  
6. Zero endpoint de “catálogo global” para `admin_empresa`.

---

## 13. Histórico / auditoria

- Usar `audit_logs` existente para create/update/status de admin e vínculos.  
- Sem `ON DELETE CASCADE` de administradora → propostas/contratações.  
- Snapshots (`administradora` text, `dados_simulacao`) preservam PDF/relatórios.

---

## 14. Riscos críticos

| Risco | Severidade | Mitigação |
|---|---|---|
| RLS pública atual de grupos | Alta | Redesign faseado + testes multiempresa |
| Casing `RACON`/`Racon` | Média | Normalização no backfill |
| APIs integration/public listam tudo | Alta | Filtro por concessão / tenant |
| Quebra simulador/PDF/contratação | Alta | dual-write texto+UUID; sem rename `grupos_cotas` |
| Confundir `seguradoras` com administradoras | Baixa | Domínios separados (seguro ≠ admin de consórcio) |
| Credenciais no catálogo global | Alta | Credenciais só no vínculo empresa |

---

## 15. Plano de implementação recomendado

| Etapa | Conteúdo | Status |
|---|---|---|
| **E0** | Auditoria + desenho | **FEITA** (push `d6ec927`) |
| **E1** | Migration 047 fundação (local) | **FEITA localmente; NÃO aplicada** |
| **E2** | Libs/repositórios + helpers de autorização + auditoria app | Não iniciada |
| **E3** | Admin Superadmin: CRUD catálogo global | Não iniciada |
| **E4** | UI `/admin/empresas/[id]`: gerenciar concessões | Não iniciada |
| **E5** | Backfill legado + adapters de leitura (manter texto) | Não iniciada |
| **E6** | Filtrar listagens/APIs por concessão; erros uniformes; redesign RLS grupos | Não iniciada |
| **E7** | Testes confidencialidade (Gauchinho vs Empresa B) | Não iniciada |
| **E8** | Preview/homologação | Não iniciada |
| **E9** | Produção (flags/gates se necessário) | Não iniciada |

Fase 5 (evolução grupos/opções) permanece **fora** deste escopo.

---

## 16. Baseline técnico

### E0
| Check | Resultado |
|---|---|
| `npm test` | **487 passed** (96 files) |
| `npm run build` | **exit 0** |
| Migrations | **001–046** local=remote |

### E1 (2026-08-08)
| Check | Resultado |
|---|---|
| Push E0 | `origin/...` = `d6ec92792bc43d9e78e84de2858db457435f799c` |
| `supabase migration list --linked` | **001–046** local=remote; **047 somente local** |
| `supabase db push --linked --dry-run` | Would push **only** `047_fase4_catalogo_global_administradoras.sql` |
| `npm test` | **487 passed** (96 files) |
| `npm run build` | **exit 0** |
| Apply remoto 047 | **NÃO executado** |

---

## 17. Status por etapa

| Etapa | Status |
|---|---|
| E0 Auditoria e desenho | **FEITA** (remoto `d6ec927`) |
| E1 Fundação estrutural | **FEITA localmente** (migration + docs; **não aplicada**) |
| E2–E9 | **Não iniciadas** |
| Fase 4 completa | **Não** |
| Fase 5 | **Não iniciada** |

---

## 18. Explicitamente NÃO feito na E0

Apply SQL · alteração RLS operacional · deploy · preview · concessão Empresa B · migração de grupos/cotas · alteração simulador/propostas/contratação · APIs de administradora · motor de comissão · Fase 5.

---

## 19. E1 — Fundação estrutural (detalhe)

### 19.1 Migration
* Arquivo: `supabase/migrations/047_fase4_catalogo_global_administradoras.sql`
* SHA256 (arquivo local): `BC6C39DB751CB235005AAE7BB32A1AFA5DABB2DCB1F9E2E0689DB3BECCBB078B`
* Número confirmado via `ls` + `migration list` (não havia outra 047)

### 19.2 Schema `administradoras`
| Campo | Tipo / regra |
|---|---|
| `id` | `uuid` PK default `gen_random_uuid()` |
| `nome` | `text not null` |
| `nome_fantasia`, `razao_social`, `cnpj`, `logo_url`, `site_url` | `text` nullable |
| `slug` | `text not null` unique (normalizado lowercase) |
| `status` | `ATIVA` \| `INATIVA` |
| `recursos_integracao`, `metadata` | `jsonb` default `{}` (sem secrets) |
| timestamps + `created_by_usuario_id` / `updated_by_usuario_id` | sim |
| CNPJ | normalizado (só dígitos); unique parcial quando preenchido |

### 19.3 Schema `empresa_administradoras`
| Campo | Tipo / regra |
|---|---|
| `id` | `uuid` PK |
| `empresa_id` | FK `empresas` **ON DELETE RESTRICT** |
| `administradora_id` | FK `administradoras` **ON DELETE RESTRICT** |
| Unique | `(empresa_id, administradora_id)` |
| `status` | `ATIVA` \| `INATIVA` \| `SUSPENSA` |
| `codigo_franquia`, `codigo_comercial`, `contato_interno`, `observacoes` | nullable |
| `configuracoes` | `jsonb` default `{}` (vazio; sem credenciais) |

### 19.4 Seed Racon
* UUID determinístico v5(DNS, `saas.gauchinho.administradora.racon`) = **`c5f8ecb4-cb5a-5014-b567-50484719b404`**
* `nome`/`nome_fantasia` = `Racon`; `slug` = `racon`; `status` = `ATIVA`
* Sem CNPJ / razão social / site / integrações inventados
* Metadata registra aliases legados `RACON`/`Racon` (sem backfill)

### 19.5 Vínculo Gauchinho
* Identificação: `empresas.slug = 'gauchinho'` (**único**; UUID `7170f38e-15dd-4b19-8588-51e9a9cf0d4c`)
* Migration aborta se slug ausente ou não único
* Concessão `ATIVA` Gauchinho × Racon
* Empresa B (`8e4e13f9-80e6-44db-a21b-584a43b6f024`, `em_treinamento`): assert **0** concessões

### 19.6 `grupos_consorcio`
* Adiciona `administradora_id uuid NULL` FK restrict + índice
* **Não** remove/altera coluna texto `administradora`
* **Não** executa backfill (assert pós-seed: 0 preenchidos)
* Texto atual permanece `RACON`×16 + `Racon`×3

### 19.7 RLS (decisão E1 — mais restritiva)
| Tabela | SELECT | INSERT/UPDATE | DELETE |
|---|---|---|---|
| `administradoras` | só Superadmin | só Superadmin | sem policy (soft status) |
| `empresa_administradoras` | só Superadmin | só Superadmin | sem policy (soft status) |

Tenant / `admin_empresa` / consultor / parceiro: **sem** leitura direta nesta E1.  
Helpers de leitura filtrada ficam para E2/E6.  
Não há `authenticated SELECT true`.

### 19.8 Permissões
Criadas e concedidas **somente** a `super_admin`:
* `gerenciar_catalogo_administradoras`
* `gerenciar_administradoras_empresa`

Explicitamente removidas de `admin_empresa` / `parceiro_comercial` se existirem vínculos.

### 19.9 Helpers SECURITY DEFINER
* Reutiliza `public.is_platform_superadmin()` (043) — sem duplicar
* Cria normalizadores SQL: `normalize_administradora_slug`, `normalize_cnpj_digits` (`search_path=public`, revoke PUBLIC)
* Triggers BEFORE WRITE (não SECURITY DEFINER de autorização): `administradoras_before_write`, `empresa_administradoras_before_write`
* `set_updated_at` reutilizado

### 19.10 Índices
* `administradoras(slug)` unique; `administradoras(status)`; `administradoras(cnpj)` unique parcial
* `empresa_administradoras(empresa_id)`, `(administradora_id)`, `(empresa_id, status)` + unique par
* `grupos_consorcio(administradora_id)`

### 19.11 Auditoria
* `audit_logs` existe com: `user_id`, `company_id`, `action`, `details`, `ip_address`, `created_at`
* E1 **não** cria sistema paralelo nem triggers de audit (escritas de negócio virão na camada app E2/E3)
* Campos/tabelas da 047 são suficientes para registrar create/update/status/concessão/suspensão/reativação via `action` + `details`

### 19.12 Checklist A–N (estático + asserts na migration)
Validado estaticamente; asserts SQL embutidos na 047 para G/H/I/L em apply futuro.  
Limitação: sem Postgres local descartável — runtime completo só após apply autorizado.

### 19.13 Compatibilidade / não-escopo E1
* APIs / simulador / propostas / contratações / cartas / PDF / admin grupos: **intactos**
* RLS `grupos_public_read` / `cotas_public_read` / modalidades: **intactas** (risco conhecido → E6)
* Site deve continuar igual após apply futuro da 047 sem código novo (coluna nullable + texto legado)

### 19.14 Riscos E1
| Risco | Severidade | Nota |
|---|---|---|
| RLS pública de grupos permanece | Alta | Consciente; E6 |
| Seed exige `slug=gauchinho` | Média | Abort seguro se ausente |
| Apply da 047 ainda não homologada em runtime remoto | Média | Dry-run ok; aguardar autorização |
| Tenant sem SELECT em concessões | Baixa/Desejada | Pode exigir RPC E2 antes de UI tenant |

### 19.15 Recomendação sobre aplicar 047
**Aplicar somente após autorização explícita**, em janela controlada, com checklist pós-apply (contagens, Racon única, Gauchinho×Racon, Empresa B=0, 19 textos intactos, 0 backfill, smoke site). Não há bloqueio estrutural no dry-run; risco residual é operacional (primeira apply), não de conflito com 001–046.
