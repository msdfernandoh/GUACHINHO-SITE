# Relatório de Fase 257 — Deduplicação Estrita de Leads por Telefone, Consolidação de Histórico e Fase Novo Lead

**Data:** 21/09/2026  
**Módulo:** CRM & Gestão Comercial de Vendas (Multiempresa / SaaS)  
**Ambiente:** Next.js 15 (App Router), React 19, TypeScript, Supabase Postgres  
**Empresa Referência:** Gauchinho Consórcios (Tenant 1 — `7170f38e-15dd-4b19-8588-51e9a9cf0d4c`)  
**Status:** CONCLUÍDO (Testes Vitest: 33/33 aprovados, TypeScript check: 0 erros, Supabase migrations 238 e 239 aplicadas com sucesso)

---

## 1. Contexto e Diagnóstico

O usuário solicitou auditoria completa e correção no comportamento de deduplicação de leads:
1. **Não Duplicação de Leads Ativos:** Quando o mesmo lead (identificado pelo telefone/WhatsApp) entrar novamente no funil através de qualquer canal (site, simulador, calculadoras, eventos, sorteios, chat IA ou admin), suas informações devem ser unificadas, **atualizando a fase para "Novo lead"**, adicionando os novos detalhes comerciais, mantendo todos os históricos anteriores e deixando apenas a última observação no campo de observações.
2. **Exceção Exclusiva para Leads Ganhos:** A **única** situação em que é permitido gerar novo lead (duplicação) é quando o lead anterior já foi concluído em estado Ganho / Venda Fechada (`fechado = true` / `is_won = true`), representando uma nova negociação para o cliente recorrente sem alterar ou sobrescrever os dados da venda fechada anterior.
3. **Auditoria e Unificação de Duplicidades Existentes:** Localizar todos os números de telefone duplicados existentes na base de produção e agrupá-los conforme as regras canônicas.

### Diagnóstico da Base de Produção:
- Foram auditados os 138 leads da base ativa do Supabase.
- Identificou-se **8 números de telefone com duplicidades** (totalizando 17 registros, sendo 9 registros duplicados legados):
  1. `(66) 99985-2176` (2 registros): "GABRIELLI" e "Geziel Mizael".
  2. `(66) 99912-6120` (3 registros): "Juliana" e "Daniel" (2 registros com segundos de diferença).
  3. `(66) 99621-0465` (2 registros): "Laura Cervelheira Silva" e "laura teste".
  4. `(66) 99936-3247` (2 registros): "Júlio dos Santos Monteiro" (2 registros).
  5. `(65) 99601-8085` (2 registros): "Araçanan Marcolan" (2 registros).
  6. `(65) 99998-0104` (2 registros): "Matheus Felipe" e "Matheus Hartman".
  7. `(65) 99648-9121` (2 registros): "Liliana Lotti de Camargo" e "Liliana".
  8. `(66) 99938-5096` (2 registros): "Cleosmar Lopes Rodrigues" (2 registros).
- Nenhum dos 17 registros estava no funil de ganho. Portanto, todos foram consolidados em 1 único lead por telefone.

---

## 2. Soluções Implementadas

### 2.1. Consolidação e Migração dos Dados no Banco
- Executado script transacional de consolidação:
  - Todas as tabelas filhas vinculadas aos IDs duplicados (`leads_historico`, `propostas`, etc.) foram reatribuídas com segurança para o ID do lead principal.
  - O lead principal de cada grupo foi atualizado para a etapa **"Novo lead"** (`status = 'Novo'`, `fechado = false`, `perdido_at = null`).
  - O histórico de abordagens e cadastros anteriores foi consolidado com data e hora no campo `historico_cadastros`.
  - O campo `observacoes` foi atualizado com a última observação informada.
  - Os registros duplicados secundários foram removidos.
  - **Resultado:** A base passou de 138 para 129 leads, com **zero telefones duplicados**.

### 2.2. Migrações e RPC no Supabase (Migrations 238 e 239)
- **Migration 238:** Padronização da FK de indicações com `ON DELETE CASCADE` e sincronização de leads fechados para a etapa `Venda fechada`.
- **Migration 239:** Atualização da procedure atômica `rpc_upsert_lead_por_telefone(jsonb)`:
  - Bloqueio atômico via `pg_advisory_xact_lock` pelo telefone normalizado.
  - Quando reencontra lead ativo não ganho:
    - Atualiza `etapa_id` para a etapa com slug `novo_lead` da empresa ativa.
    - Define `status = 'Novo'`, `fechado = false`, `perdido_at = null`.
    - Atualiza os dados comerciais (valor pretendido, produto de interesse, etc.).
    - Concatena novo bloco cronológico no `historico_cadastros`.
    - Define `observacoes` exclusivamente com a última observação fornecida.
  - Quando reencontra lead em estado Ganho:
    - O lead ganho permanece 100% congelado e inalterado.
    - Gera automaticamente uma cópia como nova negociação na etapa `novo_lead`.

### 2.3. Unificação no Código da Aplicação (`gauchinho-app`)
- **Fallback Client-Side (`src/lib/crm/upsert-lead.ts`):**
  - Alinhado com a RPC: ao atualizar lead ativo, busca a etapa `novo_lead` da empresa, redefine `fechado = false`, `status = 'Novo'`, atualiza `historico_cadastros` e preserva a última observação em `observacoes`.
- **Rotas Públicas e de IA Conectadas:**
  - `src/app/api/ia/chat/route.ts`: as funções `criarLeadGuiado` e `criarLeadFromConversa` agora utilizam `upsertLeadPorTelefone`.
  - `src/app/api/public/leads/ia-fallback/route.ts`: atualizado para utilizar `upsertLeadPorTelefone`.

---

## 3. Validação e Qualidade

- **Verificação no Banco de Produção:**
  `node scratch/check_duplicates.js`  
  **Resultado:** `Total phone numbers with duplicates: 0`.
- **Testes Unitários:**
  `npm --prefix gauchinho-app test -- run src/lib/crm`  
  **Resultado:** 5 arquivos de teste, **33/33 testes aprovados**.
- **Supabase CLI:**
  `npx supabase db push --dry-run`  
  **Resultado:** `Remote database is up to date.`
