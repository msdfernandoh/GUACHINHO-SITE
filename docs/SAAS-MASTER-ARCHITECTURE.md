# ARQUITETURA MASTER SAAS MULTIEMPRESA — GAUCHINHO SITE

> **Versão:** 4.0.0  
> **Data de Atualização:** 10/08/2026  
> **Status da Plataforma:** Fases 1, 2, 3, 4 e 5 CONCLUÍDAS E HOMOLOGADAS EM PRODUÇÃO; MACROBLOCO B CONCLUÍDO E HOMOLOGADO EM PRODUÇÃO; MACROBLOCO C CONCLUÍDO E HOMOLOGADO EM PRODUÇÃO; **MACROBLOCO D (RECEBIMENTOS, PAGAMENTOS, REPASSES, ESTORNOS, COMPENSAÇÕES E CAIXA) IMPLEMENTADO E HOMOLOGADO EM PREVIEW (AGUARDANDO MERGE E DEPLOY PRODUÇÃO)** (Migration 055 aplicada no banco remoto Supabase; `001-055` local=remote; código compilado e testado 658/658 PASS; Preview Vercel `https://guachinho-site-ld834076b-hugo-8097s-projects.vercel.app`; Livro Razão de Caixa `caixa_movimentos` imutável por `empresa_id`; abatimento automático de saldos a compensar; Empresa B com 0 concessões, 0 vendas, 0 recebimentos, 0 pagamentos e 0 caixa)  


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
* **Controle de Inadimplência, Estornos e Compensações:** Políticas graduadas de estorno, livro razão de caixa append-only e abatimento automático de compensações em repasses futuros.

---

## 2. Princípios de Preservação e Negócio

1. **Gauchinho Consórcios como Empresa 1:** A empresa Gauchinho Consórcios é a tenant número 1 da plataforma. Todos os dados existentes (`usuarios`, `leads`, `propostas`, `grupos_consorcio`, `grupos_cotas`, `contratacoes_online`, `agenda_eventos`, `indices_financeiros`) são preservados integralmente.
2. **Padrão de Nomenclatura do Banco:** **Português snake_case** (`empresas`, `empresa_usuarios`, `papeis`, `permissoes`, `papel_permissoes`, `grupos_consorcio`, `grupos_cotas`, `financeiro_recebimentos`, `financeiro_pagamentos`, `financeiro_compensacoes`, `caixa_movimentos`).
3. **Identidade N:N de Usuários:** Um usuário (`public.usuarios`) pode ter vínculo ativo com uma ou mais empresas através de `public.empresa_usuarios`.
4. **Desvinculação Técnica do Consultor:** A identidade de autenticação (`auth.uid()`) se conecta a `public.usuarios.auth_user_id`. Vendas e comissões apontam para perfis operacionais de participantes/consultores (`consultant_id` / `participant_id`), nunca para `auth.uid()` diretamente.
5. **Cota Definitiva:** O número definitivo da cota nasce `NULL` e é preenchido e auditado posteriormente ao processamento da adesão pela administradora.
6. **Vagas Comerciais:** `vagas_percentual` e `vagas_texto` são parâmetros informativos da administradora, não estoque numérico decrementável.
7. **Imutabilidade do Caixa:** Lançamentos de caixa (`caixa_movimentos`) são estritamente append-only. Correções e estornos ocorrem por lançamentos de compensação ou ajustes negativos explícitos.

---

## 3. Modelo Relacional e Tabelas da Fundação SaaS

### Tabelas do Core SaaS (Fase 1 a 5)
- `empresas`, `empresa_dominios`, `empresa_branding`, `papeis`, `permissoes`, `papel_permissoes`, `empresa_usuarios`, `empresa_grupos_config`.

### Tabelas Comerciais e Vendas (Macrobloco B - Migration 053)
- `vendas`, `cotas_definitivas`.

### Tabelas do Motor de Comissões e Competências (Macrobloco C - Migration 054)
- `comissao_programas_franquia`, `comissao_regras_franquia`, `comissao_participantes_regras`, `previsoes_comissao_franquia`, `previsoes_comissao_participante`.

### Tabelas Financeiras e Livro Razão de Caixa (Macrobloco D - Migration 055)
- `financeiro_recebimentos`: Recebimentos efetuados das Administradoras por competência (`YYYY-MM`).
- `financeiro_recebimento_itens`: Itens do recebimento vinculando e liquidando previsões da franquia.
- `financeiro_pagamentos`: Pagamentos efetuados aos Participantes Comerciais ou Organizações Parceiras.
- `financeiro_pagamento_itens`: Itens do pagamento vinculando e liquidando previsões do participante.
- `financeiro_compensacoes`: Controle de saldos a compensar decorrentes de cancelamentos/estornos pós-liquidação.
- `caixa_movimentos`: Livro razão append-only de entradas e saídas de caixa por `empresa_id`.

---

## 4. Status de Homologação dos Macroblocos

| Macrobloco / Fase | Branch | Migrations | Status | Preview / Deploy |
|---|---|---|---|---|
| Fases 1 a 5 | `main` | 001–052 | HOMOLOGADO | Produção (`gauchinhoconsorcios.com.br`) |
| Macrobloco B (Comercial e Vendas) | `main` | 053 | HOMOLOGADO | Produção (`gauchinhoconsorcios.com.br`) |
| Macrobloco C (Comissões e Competências) | `main` | 054 | HOMOLOGADO | Produção (`gauchinhoconsorcios.com.br`) |
| Macrobloco D (Financeiro, Estornos e Caixa) | `feature/saas-macrobloco-d-financeiro-caixa` | 055 | HOMOLOGADO EM PREVIEW | Preview Vercel (`https://guachinho-site-ld834076b-hugo-8097s-projects.vercel.app`) |

---

## 5. Riscos e Mitigações Atuais

* **BAIXO:** Operação do motor de caixa e conciliação validada com 658/658 testes automatizados em ambiente isolado.
* **ISOLAMENTO MULTI-TENANT:** Validado de ponta a ponta com Empresa B (0 concessões $\rightarrow$ 0 vendas $\rightarrow$ 0 previsões $\rightarrow$ 0 movimentações de caixa).
* **PRÓXIMO PASSO:** Aguardar autorização formal do usuário para merge em `main` e deploy em Produção (`vercel --prod`).
