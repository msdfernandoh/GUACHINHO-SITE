# Relatório de Fase 256 — Correção de Exclusão de Leads no CRM e Transição Irrestrita de Etapas sem Exigência de Proposta

**Data:** 21/09/2026  
**Módulo:** CRM & Gestão Comercial de Vendas (Área Administrativa / Staff / ERP)  
**Ambiente:** Next.js 15 (App Router), React 19, TypeScript, Supabase Postgres  
**Empresa Referência:** Gauchinho Consórcios (Tenant 1 — `7170f38e-15dd-4b19-8588-51e9a9cf0d4c`)  
**Status:** CONCLUÍDO (Testes Vitest: 32/32 aprovados, TypeScript check: 0 erros, Lint: 0 erros, Build de Produção: 159/159 rotas compiladas com sucesso)

---

## 1. Contexto e Diagnóstico

O usuário solicitou resolução de dois problemas críticos na gestão do CRM de Vendas:
1. **Erro ao excluir leads em lote:** Ao selecionar múltiplos leads na listagem administrativa (`/admin/leads`) e acionar o botão "Excluir selecionados", a aplicação disparava uma exceção não tratada em produção, resultando na tela de erro do React (`Minified React error #441`).
2. **Leads fechados alocados em etapas erradas e travamento de transição:** Diversos leads que já haviam fechado negócio (`fechado = true` / `status = 'ganho'`) estavam listados na coluna "Novo lead" ou em etapas iniciais do funil. Além disso, a troca de etapa no formulário de edição exigia navegação até a aba "Fechamento" e preenchimento forçado de dados de proposta/fechamento (`valor_fechado`, `produto_fechado`), impedindo que correções operacionais e reclassificações rápidas fossem realizadas pelos consultores.

### Causas Raízes Identificadas:
- **Exclusão:** Na Migration 179 (`programa_indicacoes`), a chave estrangeira `lead_id` foi criada com `ON DELETE RESTRICT`. Qualquer lead associado ao programa de indicações bloqueava a deleção física com violação de integridade referencial. Nas Server Actions do Next.js App Router, o lançamento de `throw new Error(...)` através da barreira cliente-servidor é obfuscado pelo React em build de produção como `#441`.
- **Inconsistência de Etapas em Leads Fechados:** A migration anterior de backfill de etapas (Migration 235) verificava apenas `LOWER(status) = 'fechado'`, deixando registros com `status = 'ganho'` e `fechado = true` vinculados à etapa inicial `Novo lead`.
- **Transição de Etapa Restritiva:** O formulário de edição `/admin/leads/[id]` só expunha um `select` com opções legadas do enum de status (que não atualizava `etapa_id`), e para etapas ganhas forçava o fluxo de fechamento completo. Além disso, a listagem não permitia alteração de etapa em lote nem troca rápida inline.

---

## 2. Soluções Implementadas

### 2.1. Banco de Dados e Migração (Migration 237)
- **Arquivo:** `supabase/migrations/237_corrigir_fk_indicacoes_e_etapas_leads_fechados.sql`
- Ajustou a chave estrangeira da tabela `programa_indicacoes`:
  - `ALTER TABLE public.programa_indicacoes DROP CONSTRAINT IF EXISTS programa_indicacoes_lead_id_fkey;`
  - `ALTER TABLE public.programa_indicacoes ADD CONSTRAINT programa_indicacoes_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;`
- Reclassificou e unificou os leads fechados/ganhos do Tenant 1:
  - Leads com `fechado = true` ou `status IN ('ganho', 'fechado')` foram vinculados diretamente à etapa oficial `f6766306-3bbe-418b-925e-2699b0b81b7f` (*Venda fechada*), padronizando `status = 'Venda fechada'`.
  - Script de migração executado e auditado via cliente administrativo Supabase, sincronizando com sucesso os leads identificados na demanda (incluindo MONICA LUZIA SINHORI, ORLEI OLIVEIRA SILVA, VANESSA LANDO, JANSER).

### 2.2. Robustez das Server Actions (`src/app/admin/leads/actions.ts`)
- **Exclusão Segura:**
  - `bulkDeleteLeadsAction`: Limpa previamente vínculos em `programa_indicacoes` para os IDs selecionados e remove os leads de forma transacional segura.
  - Substituição de `throw new Error()` por retorno tipado `{ ok: boolean, deleted?: number, error?: string }`, evitando falhas de serialização e erros minificados no React.
  - `deleteLeadAction`: Adaptada com o mesmo padrão seguro para exclusão individual.
- **Transição de Etapas sem Bloqueio:**
  - Criada a action `bulkUpdateLeadEtapaAction(leadIds, etapaId)` para atualização em lote da etapa de múltiplos leads selecionados. Sincroniza `etapa_id`, `status` da etapa e ajusta `fechado = Boolean(etapa.is_won)`.
  - Atualizada a action `updateLeadAction`: agora recebe `etapa_id` do formulário principal e sincroniza atomicamente `etapa_id`, `status` e a flag `fechado`.
  - Atualizada a action `updateLeadEtapaAction`: quando um lead é movido de uma etapa de ganho para uma etapa intermediária, redefine `fechado = false` e limpa `perdido_at`, garantindo flexibilidade total de movimentação no Kanban sem travar o lead em estado ganho perpétuo.

### 2.3. Interface do Usuário (UI / UX)
1. **Listagem de Leads com Ações em Lote e Inline (`lead-list-with-bulk.tsx`):**
   - **Barra de Ações em Massa:** Adicionado seletor dropdown das 12 etapas canônicas do funil junto ao botão `Mudar etapa (N)`, permitindo mover múltiplos leads selecionados de uma só vez.
   - **Seletor Rápido de Etapa na Tabela:** Adicionado um dropdown compacto em cada linha da tabela de leads, possibilitando ao operador corrigir a etapa de qualquer lead imediatamente com 1 clique, sem precisar entrar nos detalhes do lead.
   - **Tratamento de Exclusão:** Mensagens de erro e confirmação amigáveis na exclusão de leads, sem travamento de tela.
2. **Edição Detalhada do Lead (`/admin/leads/[id]/page.tsx`):**
   - No formulário principal de informações do lead, o campo de status legado foi substituído pelo seletor oficial de **Etapa do Funil CRM** (com as 12 etapas canônicas: Novo lead, Contato realizado, Qualificado, Reunião agendada, Reunião realizada, Proposta enviada, Documentação/Cadastro, Boleto enviado, Venda fechada, Pós-venda, Perdido/Desqualificado, Stand-by).
   - O consultor pode alterar a etapa para qualquer fase livremente sem necessidade de preencher proposta ou formulário de fechamento.
3. **Pipeline Kanban (`crm-kanban-board.tsx` & `crm-stage-move-modal.tsx`):**
   - O agrupamento de colunas do Kanban assegura que qualquer lead com `fechado = true` ou `status = 'ganho'` seja alocado na coluna "Venda fechada".
   - A movimentação otimista de cards no Kanban reflete fielmente se a coluna destino é `is_won` ou não.
   - O modal de confirmação de avanço de etapa (`CrmStageMoveModal`) agora detecta quando o destino é uma etapa ganha e exibe um distintivo verde de comemoração, sem exigir preenchimento de data de retorno ou próximo passo.

---

## 3. Arquivos Modificados e Criados

| Arquivo | Natureza | Descrição |
|---------|----------|-----------|
| `supabase/migrations/237_corrigir_fk_indicacoes_e_etapas_leads_fechados.sql` | Criação | Migração com `ON DELETE CASCADE` para `programa_indicacoes` e backfill de leads fechados. |
| `gauchinho-app/src/app/admin/leads/actions.ts` | Modificação | Retorno seguro `{ ok, error }` em exclusão, `bulkUpdateLeadEtapaAction`, e sincronização flexível de etapas. |
| `gauchinho-app/src/components/admin/crm/lead-list-with-bulk.tsx` | Modificação | Dropdown de etapa em lote e seletor rápido inline na listagem de leads. |
| `gauchinho-app/src/app/admin/leads/page.tsx` | Modificação | Carregamento server-side das etapas do funil para o componente de listagem. |
| `gauchinho-app/src/app/admin/leads/[id]/page.tsx` | Modificação | Seletor oficial das 12 etapas do funil no formulário de edição do lead. |
| `gauchinho-app/src/components/erp/crm/erp-leads-view.tsx` | Modificação | Tratamento resiliente do resultado de exclusão em lote. |
| `gauchinho-app/src/components/admin/crm/crm-kanban-board.tsx` | Modificação | Agrupamento de leads fechados na coluna correta e atualização otimista de status. |
| `gauchinho-app/src/components/admin/crm/crm-stage-move-modal.tsx` | Modificação | Adequação de validações para etapas ganhas sem campos desnecessários. |
| `gauchinho-app/src/lib/crm/dashboard-query.ts` | Modificação | Re-exportação de utilitário `extrairValorParcelaLead`. |
| `gauchinho-app/src/lib/crm/crm.test.ts` | Modificação | Atualização de testes unitários do módulo CRM. |

---

## 4. Validação e Qualidade

- **Testes Unitários:**
  `npm --prefix gauchinho-app test -- run src/lib/crm`  
  **Resultado:** 5 arquivos de teste, **32/32 testes aprovados**.
- **TypeScript:**
  `node gauchinho-app/node_modules/typescript/bin/tsc --noEmit -p gauchinho-app/tsconfig.json`  
  **Resultado:** **0 erros** de compilação.
- **ESLint:**
  `npm --prefix gauchinho-app run lint:errors`  
  **Resultado:** **0 erros**.
- **Build de Produção:**
  `npm --prefix gauchinho-app run build`  
  **Resultado:** **Compilado com sucesso em 12.7s**, 159/159 rotas estáticas e dinâmicas geradas sem erros.
