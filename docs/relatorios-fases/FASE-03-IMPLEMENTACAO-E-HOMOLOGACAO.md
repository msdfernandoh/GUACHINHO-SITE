# FASE 3 — Participantes Comerciais e Sites de Parceiros

**Projeto:** Gauchinho Site (trilha SaaS multiempresa)  
**Branch tip ao abrir o planejamento:** `main` @ `b3e6247`  
**Data de abertura do planejamento:** 2026-08-06  
**Fonte oficial de nome/escopo:** `docs/SAAS-MASTER-ARCHITECTURE.md` §5  
**Dependência imediata:** Fase 2 **CONCLUÍDA E HOMOLOGADA EM PRODUÇÃO**

> **Estado desta fase:** somente **análise / plano / dúvidas**.  
> Nenhuma implementação, migration, alteração de banco, deploy ou código da Fase 3 foi realizada.

---

## Matriz de governança (obrigatória)

| Dimensão | Status |
|---|---|
| Analisado | **PARCIAL** — título e princípios no SAAS-MASTER; detalhe funcional insuficiente |
| Aprovado | **NÃO** — aguarda aprovação explícita do plano e respostas às dúvidas |
| Código criado | **NÃO** |
| Migration criada | **NÃO** |
| Testado localmente | **NÃO** |
| Aplicado em produção | **NÃO** |
| Commitado (código Fase 3) | **NÃO** |
| Enviado ao Git (código Fase 3) | **NÃO** |
| Deployado | **NÃO** |
| Homologado | **NÃO** |

---

## STATUS ATUAL

```
FASE 3 — PLANEJAMENTO / AGUARDANDO APROVAÇÃO
IMPLEMENTAÇÃO — NÃO INICIADA
MIGRATION — NÃO CRIADA
BANCO — NÃO ALTERADO
DEPLOY — NÃO REALIZADO
FASE 2 — CONCLUÍDA (pré-requisito OK)
FALLBACK EMERGENCIAL FASE 2 — MANTIDO (fora do escopo desta fase remover)
FASE 4 — NÃO INICIADA
```

---

## 1. Nome e objetivo (conforme roadmap SaaS)

**Nome oficial:** Participantes Comerciais e Sites de Parceiros

**Objetivo inferido (não detalhado no roadmap):**  
Introduzir o modelo de **participantes comerciais** da plataforma (vendedores, atendentes, consultores, gestores, indicadores, imobiliárias e parceiros) e a capacidade de **sites de parceiros**, alinhados ao multi-tenant das Fases 1–2, com desvinculação técnica entre `auth.uid()` e identidade comercial (`participant_id` / `consultant_id`).

> O documento `docs/PLANO-EXECUCAO-FASES.md` descreve outra numeração histórica em que “Fase 3” = **Proposta PDF premium**.  
> **Esta trilha SaaS NÃO usa essa definição.** A fonte obrigatória é `SAAS-MASTER-ARCHITECTURE.md`.  
> PDF premium permanece fora do escopo da Fase 3 SaaS até reclassificação formal.

---

## 2. Regras de negócio envolvidas (conhecidas vs. lacunas)

### 2.1 Conhecidas (arquitetura master)

- Participantes comerciais incluem: vendedores, atendentes, consultores, gestores, indicadores, imobiliárias e parceiros.
- Vendas/comissões futuras apontam para participante/consultor operacional — **nunca** `auth.uid()` direto.
- Usuário Auth ↔ `usuarios` via `auth_user_id`; vínculo multiempresa via `empresa_usuarios`.
- Gauchinho é empresa 1; dados legados preservados.
- Sites/domínios/branding já existem (Fase 2) e podem ser reutilizados por parceiros — **como** ainda não está especificado.

### 2.2 Lacunas de regra de negócio (bloqueiam implementação)

Ver §16 — perguntas objetivas. Sem respostas, **não** se deve criar schema.

---

## 3. Dependências das Fases 1 e 2

| Dependência | Estado | Uso esperado na Fase 3 |
|---|---|---|
| `empresas`, `empresa_usuarios`, `papeis`, `permissoes` | Produção (043) | Escopo de participante por empresa; papéis |
| `is_platform_superadmin`, `is_company_member`, `has_company_role` | Produção | RLS / autorização |
| `empresa_dominios`, `empresa_branding` | Produção (044) | Possível site/domínio de parceiro ou reuso |
| Resolução de tenant por host + preview seguro | Produção (`12a5e61`) | Sites de parceiros não podem quebrar Gauchinho |
| Empresa B (demo) | Não publicada | Não usar como modelo de parceiro publicado |
| Fallback emergencial hosts oficiais | Mantido | Fora do escopo remover na Fase 3 |

---

## 4. Schema atual relevante (somente leitura)

Tabelas existentes relacionadas ao tema (produção):

| Tabela | Relação com Fase 3 |
|---|---|
| `usuarios` | Auth + perfil legado (`master`/`srd`/`imobiliaria`/`visualizador`); `is_consultor`; `imobiliaria_id` |
| `empresa_usuarios` + `papeis` | Já há `consultor`, `gestor`, `parceiro_imobiliaria`, `admin_empresa`, `visualizador`, `super_admin` |
| `imobiliarias` | Legado Fase produto (vitrine imóveis); **não** é modelo SaaS de participante |
| `parceiros` | Legado CMS (logos/links prova social); **não** confundir com “sites de parceiros” SaaS |
| `leads` / `propostas` | Possuem campos de consultor/parceiro legados; multiempresa ainda não (Fase 6 SaaS) |
| `eventos_participantes` / `eventos_sorteio_participantes` | Participantes de **eventos/sorteio** — domínio distinto; não reutilizar sem decisão |

**Não existe hoje** tabela `participantes_comerciais` (nem equivalente SaaS explícito).

---

## 5. Tabelas que seriam criadas ou alteradas

### Status: **NÃO DEFINIDO — AGUARDA APROVAÇÃO**

Hipóteses em aberto (não implementar sem escolha):

| Hipótese | Descrição | Risco |
|---|---|---|
| A | Nova tabela `participantes_comerciais` (ou `participantes`) N:1/`empresa_id`, opcionalmente ligada a `usuarios` | Maior clareza; exige backfill |
| B | Estender só `empresa_usuarios` + novos códigos de papel | Mais simples; pode misturar login com papel comercial |
| C | Sites de parceiros = novas `empresas` + domínio/branding (reuso Fase 2) | Parceiro vira tenant; comissões/repasse futuros ficam ambíguos |
| D | Sites de parceiros = entidade própria com domínio apontando para empresa mãe + branding override | Mais fiel a “parceiro sob a empresa” |

**Decisão necessária antes de migration.**

---

## 6. Funções, triggers, índices e RLS

### Status: **NÃO DEFINIDO**

Esboço de necessidade (condicional ao modelo escolhido):

- Funções: `current_participante_id()`, checagens de membership do participante na empresa.
- RLS: isolamento por `empresa_id`; SuperAdmin global; parceiro só vê próprio escopo.
- Índices: `(empresa_id, ativo)`, unique de documento/código por empresa se houver.
- Triggers: impedir troca ilegal de `empresa_id`; auditar vínculo usuário↔participante.

Nada disso será criado sem plano aprovado.

---

## 7. Telas e rotas (previsto — rascunho)

### Status: **RASCUNHO NÃO APROVADO**

Possíveis (a confirmar):

| Área | Rota candidata | Observação |
|---|---|---|
| Admin empresa | `/admin/participantes` | CRUD participantes da empresa ativa |
| Admin SuperAdmin | `/admin/empresas/[id]/participantes` | Visão plataforma |
| Site parceiro | host em `empresa_dominios` ou path `/p/[slug]` | Modelo A/B/C/D acima |
| Área logada parceiro | `/parceiro/...` ou reuso `/admin` com menus filtrados | Depende se parceiro tem login |

---

## 8. APIs

### Status: **NÃO DEFINIDO**

Candidatas: server actions admin; APIs públicas só se site de parceiro capturar lead (pode ser Fase 6).  
**Não** criar APIs nesta etapa de planejamento.

---

## 9. Arquivos previstos

### Status: **NENHUM CRIADO**

Quando aprovado, candidatos típicos (lista não autorizada):

- `supabase/migrations/045_*.sql` (nome TBD)
- `gauchinho-app/src/lib/participantes/*`
- `gauchinho-app/src/app/admin/participantes/*`
- ajustes em `proxy.ts` / resolução de tenant **somente se** sites de parceiros exigirem
- testes Vitest + relatório desta fase

---

## 10. Dados legados afetados

| Dado | Impacto potencial |
|---|---|
| `usuarios` com `is_consultor` / perfil `srd` | Possível mapeamento para participante |
| `usuarios.imobiliaria_id` + `imobiliarias` | Decidir se imobiliária vira participante ou permanece legado |
| `parceiros` (CMS) | **Não** migrar automaticamente para sites SaaS |
| `leads` / `propostas` (consultor/parceiro) | Backfill de FKs pode ser Fase 6, não 3 |
| Contagens Fase 2 | Devem permanecer intactas |

---

## 11. Estratégia de backfill

### Status: **NÃO DEFINIDA**

Opções a decidir:

1. Criar participante “espelho” para cada `usuarios` consultor ativo da Gauchinho.
2. Não backfillar — cadastro manual na Fase 3; backfill na Fase 6 (CRM).
3. Mapear `imobiliarias` → participantes tipo `imobiliaria` (arriscado se misturar CMS e operacional).

**Princípio:** zero perda; zero publicação involuntária; Gauchinho continua operacional sem interrupção.

---

## 12. Riscos

| Risco | Severidade | Mitigação |
|---|---|---|
| Confundir Fase 3 SaaS com “Proposta PDF” do plano antigo | Alta | Escopo só SAAS-MASTER |
| Confundir `parceiros` CMS com sites de parceiros | Alta | Nomes/tabelas distintos |
| Misturar participante e `usuarios` sem regra clara | Alta | Decisão A/B explícita |
| Site de parceiro vazar dados da Gauchinho | Crítica | Reusar gate de tenant Fase 2; testes de isolamento |
| Remover fallback “de passagem” | Alta | Proibido nesta fase |
| Antecipar comissões (Fases 9–10) | Média | Fora de escopo |

---

## 13. Testes (quando houver implementação)

- Unitários: vínculo participante↔empresa; negação cross-tenant.
- Integração: RLS policies.
- UI: CRUD admin; bloqueio sem permissão.
- Site parceiro (se existir): host resolve branding correto; sem dados operacionais indevidos.
- Regressão Fase 2: Gauchinho domínio oficial `source=domain`; Empresa B não publicada.
- Contagens legadas inalteradas.

---

## 14. Critérios de homologação (propostos — a aprovar)

1. Schema/migration aplicados sem corromper legado.  
2. CRUD de participantes na empresa Gauchinho (mínimo).  
3. Isolamento: Empresa B / outro tenant não vê participantes Gauchinho.  
4. Se sites de parceiros: resolução de host sem afetar Gauchinho; sem publicação acidental.  
5. Nenhuma alteração de fallback sem autorização.  
6. Contagens legadas estáveis.  
7. Relatório Fase 3 atualizado + arquitetura master.

---

## 15. Fora do escopo explícito (nesta Fase 3)

- Proposta PDF premium (`docs/PLANO-EXECUCAO-FASES.md` Fase 3 antiga)
- Catálogo global de administradoras (Fase 4 SaaS)
- Evolução de grupos (Fase 5 SaaS)
- CRM/leads/propostas multiempresa (Fase 6 SaaS)
- Contratação online multiempresa (Fase 7)
- Motor de comissões / regras de repasse (Fases 9–10)
- Remoção do fallback emergencial
- Publicar Empresa B
- Fase 4+ de qualquer trilha

---

## 16. Relação com fases futuras

```text
Fase 3 (participantes + sites parceiros)
  → Fase 4 (administradoras globais)
  → Fase 5 (grupos/opções)
  → Fase 6 (CRM/leads/propostas multiempresa)  ← consome participant_id
  → Fase 7–8 (contratação / vendas)
  → Fase 9–10 (comissões / regras de participantes)
```

Participante criado na Fase 3 é pré-requisito conceitual das Fases 6+ e 9–10.

---

## 17. Decisões registradas até agora

| # | Decisão | Status |
|---|---|---|
| D1 | Trilha oficial = SaaS (`SAAS-MASTER-ARCHITECTURE`), não o plano PDF antigo | **Proposta do agente — confirmar** |
| D2 | Sem implementação até aprovação explícita do plano | **Confirmado pelo usuário** |
| D3 | Fallback Fase 2 permanece | **Confirmado** |
| D4 | Modelo de tabela/site de parceiro | **Aberto** |

---

## 18. Dúvidas objetivas de regra de negócio (bloqueantes)

1. **Participante ≠ usuário de login?** Todo consultor/vendedor precisa ter `usuarios`+Auth, ou pode existir participante só cadastral (sem login)?  
2. **Tipos obrigatórios na Fase 3:** quais exatamente entre vendedor, atendente, consultor, gestor, indicador, imobiliária, parceiro?  
3. **Imobiliárias legadas (`imobiliarias`):** entram na Fase 3 como participantes, ficam só na Fase produto antiga, ou migram depois?  
4. **“Sites de Parceiros”:**  
   - (a) novo tenant `empresas`?  
   - (b) sub-site sob a Gauchinho com domínio próprio + branding?  
   - (c) apenas página `/parceiro/[slug]` sem domínio customizado?  
5. **Parceiro CMS (`parceiros`)** vs site de parceiro SaaS: convivem? renomear? ignorar na Fase 3?  
6. **Indicador:** é participante comercial com comissão futura, ou só vínculo de indicação em leads/eventos?  
7. **Escopo mínimo MVP da Fase 3:** só cadastro admin de participantes Gauchinho, ou já inclui 1 site de parceiro publicado em preview?  
8. **Empresa B:** deve ganhar participantes de teste nesta fase? (recomendação do agente: **não**, manter demo limpa)  
9. **Backfill:** criar participantes automaticamente a partir dos consultores atuais (`is_consultor` / papel `consultor`)?  
10. Numeração: confirmar oficialmente que **Fase 3 = Participantes Comerciais e Sites de Parceiros** (SaaS) e que PDF premium será realocado (ex.: sob Fase 6 ou fase de produto antiga).

---

## 19. Pendências

| Pendência | Owner |
|---|---|
| Respostas às dúvidas §18 | Produto / Fernando |
| Aprovação do escopo MVP | Produto |
| Aprovação do modelo de dados (hipótese A/B/C/D) | Arquitetura + Produto |
| Autorização para iniciar implementação | Usuário (explícita) |
| Remoção futura do fallback Fase 2 | Pós-estabilidade (fora da Fase 3) |

---

## 20. Próximo passo permitido

Após respostas e aprovação explícita:

1. Congelar escopo MVP da Fase 3.  
2. Desenhar migration `045_…` (rascunho revisável).  
3. Só então autorizar código + testes + preview — **sem produção automática**.

---

## STATUS FINAL (planejamento)

```
FASE 3 — ANALISADA PARCIALMENTE / PLANO APRESENTADO
APROVAÇÃO — PENDENTE
IMPLEMENTAÇÃO — NÃO INICIADA
MIGRATION — NÃO CRIADA
CÓDIGO — NÃO CRIADO
BANCO — NÃO ALTERADO
DEPLOY — NÃO REALIZADO
HOMOLOGAÇÃO — NÃO REALIZADA
LACUNA PRINCIPAL — definição funcional insuficiente no roadmap (só título)
FASE 2 — CONCLUÍDA (pré-requisito OK)
FASE 4 — NÃO INICIADA
```
