# ARQUITETURA MASTER SAAS MULTIEMPRESA — GAUCHINHO SITE

> **Versão:** 5.0.0  
> **Data de Atualização:** 10/08/2026  
> **Status da Plataforma:** Fases 1, 2, 3, 4 e 5 CONCLUÍDAS E HOMOLOGADAS EM PRODUÇÃO; MACROBLOCO B CONCLUÍDO E HOMOLOGADO EM PRODUÇÃO; MACROBLOCO C CONCLUÍDO E HOMOLOGADO EM PRODUÇÃO; MACROBLOCO D CONCLUÍDO E HOMOLOGADO EM PRODUÇÃO; **MACROBLOCO E (GESTÃO, METAS, EQUIPES, AUDITORIA, RELATÓRIOS E DASHBOARDS) IMPLEMENTADO E HOMOLOGADO EM PREVIEW (AGUARDANDO MERGE E DEPLOY PRODUÇÃO)** (Migration 056 aplicada no banco remoto Supabase; `001-056` local=remote; código compilado e testado 663/663 PASS; Preview Vercel `https://guachinho-site-rikql46ev-hugo-8097s-projects.vercel.app`; Motor de Metas Comerciais com Apuração Dinâmica; Gestão de Equipes e Tarefas; Auditoria Central com Correlation ID; Dashboards Executivo/Comercial/Financeiro; Empresa B com 0 concessões, 0 vendas, 0 equipes, 0 metas, 0 tarefas e 0 audit logs)  

> **Projeto Físico:** `C:\Fernando Hugo\GAUCHINHO SITE`  
> **Repositório Git:** `https://github.com/msdfernandoh/GUACHINHO-SITE.git`

---

## 1. Visão Geral e Objetivo Arquitetural

O projeto **Gauchinho Site** está sendo transformado em uma **plataforma SaaS multiempresa de gestão e comercialização de consórcios**.

A plataforma suportará:
* **Multi-tenant (Multiempresa):** Múltiplas empresas de consórcio operando de forma isolada e segura.
* **Sites e Domínios:** Resolução de sites públicos por subdomínio, domínio customizado ou rota.
* **Branding por Empresa ou Parceiro:** Logotipos, cores, favicons, textos, menus públicos e administrativos configuráveis.
* **Catálogo Global de Administradoras:** Entidade global para administradoras (ex: Racon), compartilhando grupos e cotas habilitados por empresa.
* **Participantes Comerciais:** Vendedores, atendentes, consultores, gestores, indicadores, imobiliárias e parceiros.
* **Motor Configurável de Comissões e Repasses:** Programas de comissão da franquia por administradora, modalidade, plano e vigência.
* **Financeiro Completo e Caixa:** Separação entre parcela do cliente (paga à administradora), comissão da empresa e repasse ao participante.
* **Gestão, Metas, Tarefas e Auditoria Central:** Equipes comerciais, motor de apuração de metas por indicador canônico, acompanhamento de tarefas operacionais e trilha de auditoria com correlation ID.

---

## 2. Princípios de Preservação e Negócio

1. **Gauchinho Consórcios como Empresa 1:** A empresa Gauchinho Consórcios é a tenant número 1 da plataforma. Todos os dados existentes (`usuarios`, `leads`, `propostas`, `grupos_consorcio`, `grupos_cotas`, `contratacoes_online`, `agenda_eventos`, `indices_financeiros`) são preservados integralmente.
2. **Padrão de Nomenclatura do Banco:** **Português snake_case** (`empresas`, `empresa_usuarios`, `papeis`, `permissoes`, `papel_permissoes`, `equipes`, `equipe_membros`, `metas_comerciais`, `tarefas_gestao`, `audit_logs_central`).
3. **Identidade N:N de Usuários:** Um usuário (`public.usuarios`) pode ter vínculo ativo com uma ou mais empresas através de `public.empresa_usuarios`.
4. **Desvinculação Técnica do Consultor:** A identidade de autenticação (`auth.uid()`) se conecta a `public.usuarios.auth_user_id`. Vendas e comissões apontam para perfis operacionais de participantes/consultores (`consultant_id` / `participant_id`), nunca para `auth.uid()` diretamente.
5. **Cota Definitiva:** O número definitivo da cota nasce `NULL` e é preenchido e auditado posteriormente ao processamento da adesão pela administradora.
6. **Imutabilidade do Caixa:** Lançamentos de caixa (`caixa_movimentos`) são estritamente append-only.
7. **Metas Não Gravam Realizado Fixo:** O realizado das metas é apurado dinamicamente a partir dos dados reais das vendas, propostas, comissões e recebimentos.

---

## 3. Modelo Relacional e Tabelas da Fundação SaaS

### Tabelas do Core SaaS (Fases 1 a 5)
- `empresas`, `empresa_dominios`, `empresa_branding`, `papeis`, `permissoes`, `papel_permissoes`, `empresa_usuarios`, `empresa_grupos_config`.

### Tabelas Comerciais e Vendas (Macrobloco B - Migration 053)
- `vendas`, `cotas_definitivas`.

### Tabelas do Motor de Comissões e Competências (Macrobloco C - Migration 054)
- `comissao_programas_franquia`, `comissao_regras_franquia`, `comissao_participantes_regras`, `previsoes_comissao_franquia`, `previsoes_comissao_participante`.

### Tabelas Financeiras e Caixa (Macrobloco D - Migration 055)
- `financeiro_recebimentos`, `financeiro_recebimento_itens`, `financeiro_pagamentos`, `financeiro_pagamento_itens`, `financeiro_compensacoes`, `caixa_movimentos`.

### Tabelas de Gestão, Metas e Auditoria (Macrobloco E - Migration 056)
- `equipes`: Equipes comerciais da empresa com gestor responsável.
- `equipe_membros`: Junção N:N de participantes comerciais em equipes.
- `metas_comerciais`: Motor de metas por empresa, equipe, participante ou parceiro.
- `tarefas_gestao`: Gestão operacional de tarefas e alertas de atraso.
- `audit_logs_central`: Trilha de auditoria central com suporte a correlation_id.

---

## 4. Status de Homologação dos Macroblocos

| Macrobloco / Fase | Branch | Migrations | Status | Preview / Deploy |
|---|---|---|---|---|
| Fases 1 a 5 | `main` | 001–052 | HOMOLOGADO | Produção (`gauchinhoconsorcios.com.br`) |
| Macrobloco B (Comercial e Vendas) | `main` | 053 | HOMOLOGADO | Produção (`gauchinhoconsorcios.com.br`) |
| Macrobloco C (Comissões e Competências) | `main` | 054 | HOMOLOGADO | Produção (`gauchinhoconsorcios.com.br`) |
| Macrobloco D (Financeiro, Estornos e Caixa) | `main` | 055 | HOMOLOGADO | Produção (`gauchinhoconsorcios.com.br`) |
| Macrobloco E (Gestão, Metas e Auditoria) | `feature/saas-macrobloco-e-gestao-dashboards` | 056 | HOMOLOGADO EM PREVIEW | Preview Vercel (`https://guachinho-site-rikql46ev-hugo-8097s-projects.vercel.app`) |

---

## 5. Riscos e Mitigações Atuais

* **BAIXO:** Operação do motor de gestão e auditoria validada com 663/663 testes automatizados.
* **ISOLAMENTO MULTI-TENANT:** Validado com Empresa B (0 equipes $\rightarrow$ 0 metas $\rightarrow$ 0 tarefas $\rightarrow$ 0 audit logs $\rightarrow$ 0 métricas).
* **PRÓXIMO PASSO:** Aguardar instrução formal do usuário para merge em `main` e deploy em Produção (`vercel --prod`).
