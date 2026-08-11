# ARQUITETURA MASTER SAAS MULTIEMPRESA — GAUCHINHO SITE

> **Versão da Arquitetura:** 5.3.0
> **Data de Atualização:** 11/08/2026
> **Status Geral do Projeto:** **MOTOR CANÔNICO DE COMISSÕES E FINANCEIRO TRANSACIONAL AUDITADO E IMPLANTADO EM PRODUÇÃO (001–063)**
> **Macroblocos A–F:** implantados em Produção. As migrations `060–063` foram auditadas, autorizadas e aplicadas. FKs/retenção, integração da auditoria, storage e performance/lint seguem em etapas próprias.
> **Infraestrutura em Produção:**  
> - **Vercel Production:** `https://gauchinhoconsorcios.com.br` (deployment `dpl_J5VA7NBXqTW7KbmiMUtzsGmrBJm3`, READY, Aliased)
> - **Supabase Database:** `eaeuoynprurmmulzhydt` (`001–063` local=remote | dry-run up to date)
> - **Suíte reproduzida na branch 060–063:** `660 PASS / 37 SKIP` (os 37 live tests ficam bloqueados por padrão)
> - **Build Next.js:** Exit Code 0 (119 páginas estáticas/dinâmicas compiladas)  
> - **Segurança & Multi-Tenant:** RLS ativo em 27 tabelas críticas, Empresa B com 0 dados/concessões, Host Resolution e RBAC formalizado em `SAAS-PERMISSIONS-MATRIX.md`.  

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

### Hardening transversal (Migrations 057–059)
- identidade canônica `auth.uid()` → `usuarios.auth_user_id` → `empresa_usuarios`;
- leitura tenant para `admin_empresa`, `gestor`, `consultor` e `visualizador`;
- escrita tenant somente para `admin_empresa` ou Platform Superadmin;
- 68 policies explícitas nas 18 tabelas internas, sem `FOR ALL`;
- integridade lógica cross-tenant por triggers;
- `caixa_movimentos` e `audit_logs_central` protegidos como append-only.

### Motor canônico e financeiro transacional (Migrations 060–063)
- regras de franquia e de participante independentes, sem percentual/default comercial implícito;
- seleção determinística por tenant, administradora explícita, vigência da venda, modalidade, opção de cota e plano/condição;
- precedência do beneficiário: participante específico, organização específica e regra genérica, com falha obrigatória em ambiguidade;
- bases permitidas: percentual sobre crédito ou valor fixo, com cronograma configurável e snapshot imutável da regra/versão;
- conversão contratação→venda→cota→previsões em RPC PostgreSQL atômico;
- recebimento e pagamento em RPCs com locks, idempotência, aritmética `numeric` e elegibilidade proporcional ao caixa da franquia efetivamente liquidado;
- compensações, consumos, cancelamentos de crédito e estornos registrados como eventos append-only; nenhum pagamento líquido negativo;
- `operacoes_idempotentes`, `financeiro_compensacao_movimentos`, `financeiro_estornos` e view `financeiro_compensacoes_saldos`;
- estado: aplicado ao projeto principal em 11/08/2026 após auditoria final e autorização explícita.

---

## 4. Status de Homologação de Todos os Macroblocos

| Macrobloco | Branch | Migrations | Status | URL / Deploy |
|---|---|---|---|---|
| Macrobloco A (Fundação SaaS & Catálogo) | `main` | 001–052 | HOMOLOGADO | Produção (`gauchinhoconsorcios.com.br`) |
| Macrobloco B (Comercial, CRM & Vendas) | `main` | 053 | HOMOLOGADO | Produção (`gauchinhoconsorcios.com.br`) |
| Macrobloco C (Motor de Comissões) | `main` | 054, 060–061 | AUDITADO E IMPLANTADO | Produção (`gauchinhoconsorcios.com.br`) |
| Macrobloco D (Financeiro, Estornos & Caixa) | `main` | 055, 062–063 | AUDITADO E IMPLANTADO | Produção (`gauchinhoconsorcios.com.br`) |
| Macrobloco E (Gestão, Metas & Auditoria) | `main` | 056 | HOMOLOGADO | Produção (`gauchinhoconsorcios.com.br`) |
| Macrobloco F (Homologação Geral & Onboarding) | `main` | 001–063 | IMPLANTADO; HOMOLOGAÇÃO INTEGRAL ABERTA | Produção (`gauchinhoconsorcios.com.br`) |

---

## 5. Declaração Final de Segurança e Riscos

* O P0 das seis APIs de gestão foi corrigido, validado em Preview independente e implantado em Produção no deploy `dpl_HG9SDAFfZyNrb9nxAw5PahRKNVGj`.
* O hardening A/B foi separado nas migrations forward-only `057–059`, homologado em branch Supabase descartável e aplicado no banco principal.
* As migrations `060–063` foram auditadas em ambiente efêmero e aplicadas no banco principal em 11/08/2026; a conferência posterior retornou `001–063` local=remote e dry-run sem pendências.
* A branch aprovada foi mesclada em `main` no commit `788195102a319a7dcd154d65a4f4fbd4437ba71f` e implantada no deployment `dpl_J5VA7NBXqTW7KbmiMUtzsGmrBJm3`; smoke anônimo público e de rota administrativa passaram conforme esperado.
* `admin.gauchinhoconsorcios.com.br` continua pendente de delegação/associação pela conta Vercel proprietária do domínio. Não há registro ativo/verificado parcial em `empresa_dominios` até que essa associação e o TLS possam ser confirmados.
* A homologação integral permanece aberta para FKs/retenção, integração da auditoria, storage e performance/lint.
* Relatórios técnicos: `docs/relatorios-fases/HOTFIX-CODEX-POS-AUDITORIA.md`, `docs/relatorios-fases/HARDENING-RLS-CODEX-POS-HOTFIX.md` e `docs/relatorios-fases/CODEX-COMISSOES-FINANCEIRO-TRANSACIONAL.md`.
