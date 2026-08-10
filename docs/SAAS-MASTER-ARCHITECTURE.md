# ARQUITETURA MASTER SAAS MULTIEMPRESA — GAUCHINHO SITE

> **Versão de Auditoria:** 5.1.0-rc.1
> **Data de Atualização:** 10/08/2026  
> **Status Geral do Projeto:** **AUDITORIA INDEPENDENTE CODEX EM BRANCH/PREVIEW; PRODUÇÃO AINDA CONTÉM RISCOS MATERIAIS**
> **Macroblocos A–F:** a implementação existe, porém B–F têm ressalvas e C/D exigem decisões de negócio antes de homologação final.
> **Infraestrutura em Produção:**  
> - **Vercel Production:** `https://gauchinhoconsorcios.com.br` (Status READY, Aliased)  
> - **Supabase Database:** `eaeuoynprurmmulzhydt` (Produção observada com estruturas até 056; migration corretiva 057 criada localmente e **não aplicada**)
> - **Supabase CLI:** comparação `migration list --linked` / `db push --linked --dry-run` não comprovada nesta auditoria por credencial de pooler local inválida; não foi executado `repair`.
> - **Suíte segura padrão:** `639 PASS`, `37 SKIP` (9 suítes live antigas agora opt-in; 8 testes independentes Codex incluídos)
> - **Build Next.js:** Exit Code 0 (119 páginas estáticas/dinâmicas compiladas)  
> - **Segurança & Multi-Tenant:** hardening de APIs/RLS preparado na branch `codex/audit-pos-antigravity`; detalhes em `docs/relatorios-fases/AUDITORIA-CODEX-POS-ANTIGRAVITY.md`.

> **Projeto Físico:** `C:\Fernando Hugo\GAUCHINHO SITE`  
> **Repositório Git:** `https://github.com/msdfernandoh/GUACHINHO-SITE.git`

---

## 1. Visão Geral e Objetivo Arquitetural

O projeto **Gauchinho Site** foi transformado em uma **plataforma SaaS multiempresa de gestão e comercialização de consórcios**.

A plataforma suporta:
* **Multi-tenant (Multiempresa):** Múltiplas empresas de consórcio operando de forma isolada e segura.
* **Sites e Domínios:** Resolução de sites públicos por subdomínio, domínio customizado ou rota.
* **Branding por Empresa ou Parceiro:** Logotipos, cores, favicons, textos, menus públicos e administrativos configuráveis.
* **Catálogo Global de Administradoras:** Entidade global para administradoras (ex: Racon), compartilhando grupos e cotas habilitados por empresa.
* **Participantes Comerciais:** Vendedores, atendentes, consultores, gestores, indicadores, imobiliárias e parceiros.
* **Motor Configurável de Comissões e Repasses:** Programas de comissão da franquia por administradora, modalidade, plano e vigência.
* **Financeiro Completo e Caixa:** Separação entre parcela do cliente (paga à administradora), comissão da empresa e repasse ao participante.
* **Gestão, Metas, Tarefas e Auditoria Central:** Equipes comerciais, motor de apuração de metas por indicador canônico, acompanhamento de tarefas operacionais e trilha de auditoria com correlation ID.
* **Onboarding & Governança:** Governança exclusiva de concessões de administradoras por `PLATFORM_SUPERADMIN`, onboarding formalizado de novos tenants e runbook de operações.

---

## 2. Princípios de Preservação e Negócio

1. **Gauchinho Consórcios como Empresa 1:** A empresa Gauchinho Consórcios é a tenant número 1 da plataforma. Todos os dados existentes (`usuarios`, `leads`, `propostas`, `grupos_consorcio`, `grupos_cotas`, `contratacoes_online`, `agenda_eventos`, `indices_financeiros`) foram preservados integralmente.
2. **Padrão de Nomenclatura do Banco:** **Português snake_case** (`empresas`, `empresa_usuarios`, `papeis`, `permissoes`, `papel_permissoes`, `equipes`, `equipe_membros`, `metas_comerciais`, `tarefas_gestao`, `audit_logs_central`).
3. **Identidade N:N de Usuários:** Um usuário (`public.usuarios`) pode ter vínculo ativo com uma ou mais empresas através de `public.empresa_usuarios`.
4. **Desvinculação Técnica do Consultor:** A identidade de autenticação (`auth.uid()`) se conecta a `public.usuarios.auth_user_id`. Vendas e comissões apontam para perfis operacionais de participantes/consultores (`consultant_id` / `participant_id`), nunca para `auth.uid()` diretamente.
5. **Cota Definitiva:** O número definitivo da cota nasce `NULL` e é preenchido e auditado posteriormente ao processamento da adesão pela administradora.
6. **Imutabilidade do Caixa:** Lançamentos de caixa (`caixa_movimentos`) são estritamente append-only.
7. **Metas Não Gravam Realizado Fixo:** O realizado das metas é apurado dinamicamente a partir dos dados reais das vendas, propostas, comissões e recebimentos.

---

## 3. Modelo Relacional e Tabelas da Fundação SaaS

### Tabelas do Core SaaS (Fases 1 a 5 - Migrations 001–052)
- `empresas`, `empresa_dominios`, `empresa_branding`, `papeis`, `permissoes`, `papel_permissoes`, `empresa_usuarios`, `empresa_grupos_config`.

### Tabelas Comerciais e Vendas (Macrobloco B - Migration 053)
- `vendas`, `cotas_definitivas`.

### Tabelas do Motor de Comissões e Competências (Macrobloco C - Migration 054)
- `comissao_programas`, `comissao_regras_franquia`, `comissao_regras_participantes`, `comissao_previsoes_franquia`, `comissao_previsoes_participantes`.

### Tabelas Financeiras e Caixa (Macrobloco D - Migration 055)
- `financeiro_recebimentos`, `financeiro_recebimento_itens`, `financeiro_pagamentos`, `financeiro_pagamento_itens`, `financeiro_compensacoes`, `caixa_movimentos`.

### Tabelas de Gestão, Metas e Auditoria (Macrobloco E - Migration 056)
- `equipes`, `equipe_membros`, `metas_comerciais`, `tarefas_gestao`, `audit_logs_central`.

---

## 4. Status de Homologação de Todos os Macroblocos

| Macrobloco | Branch | Migrations | Status | URL / Deploy |
|---|---|---|---|---|
| Macrobloco A (Fundação SaaS & Catálogo) | `main` | 001–052 | CORRETO COM RESSALVAS | Produção existente; drift CLI não reconfirmado |
| Macrobloco B (Comercial, CRM & Vendas) | auditoria Codex | 053 + 057 | CORRIGIDO PARCIALMENTE | Preview; atomicidade ainda pendente |
| Macrobloco C (Motor de Comissões) | auditoria Codex | 054 + 057 | PROBLEMA MATERIAL | Percentuais/base/default automático exigem decisão |
| Macrobloco D (Financeiro, Estornos & Caixa) | auditoria Codex | 055 + 057 | PROBLEMA MATERIAL | Fluxos não atômicos e elegibilidade incorreta |
| Macrobloco E (Gestão, Metas & Auditoria) | auditoria Codex | 056 + 057 | CORRIGIDO NO CÓDIGO | APIs, RLS, IDOR e dashboard endurecidos |
| Macrobloco F (Homologação Geral & Onboarding) | auditoria Codex | 001–057 | NÃO COMPROVADO | Claims anteriores excediam a evidência técnica |

---

## 5. Declaração Final de Segurança e Riscos

* A Produção respondia sem autenticação nas seis APIs `/api/admin/gestao/*` auditadas; a correção existe apenas na branch/Preview até nova autorização.
* A migration 057 corrige escrita indevida de `visualizador`, identidade RLS da 056, integridade cross-tenant de gestão e imutabilidade de caixa/auditoria; ainda não foi aplicada remotamente.
* Comissões e financeiro não podem ser declarados homologados: faltam decisão formal de regras e transações atômicas no banco.
* Sorteios permanecem fora deste escopo corretivo e não foram alterados.
