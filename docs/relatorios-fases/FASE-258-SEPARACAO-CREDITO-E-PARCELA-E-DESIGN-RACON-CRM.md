# RELATÓRIO DE FASE — FASE 258: SEPARAÇÃO ESTRITA DE CRÉDITO VS. PARCELA E DESENHO EXECUTIVO RACON SINOP NO CRM

**Data de Conclusão:** 21 de Setembro de 2026  
**Ambiente:** Supabase PostgreSQL Produção + Next.js App Router Multi-tenant  
**Migrations Aplicadas:** `240_reconciliacao_vendas_fechadas_e_leads_sync.sql`, `241_separacao_valor_credito_e_parcela_leads.sql`

---

## 1. Objetivos da Fase

1. **Reconciliação e Transparência Comercial de Vendas Fechadas (Fase 258 - Parte A):**
   - Integrar 100% das vendas confirmadas no ERP (`public.vendas`) ao funil do CRM (`public.leads`), garantindo que o número exibido em "Vendas no mês" e na meta mensal bata perfeitamente com o total real faturado no mês corrente (reconciliando negócios vultosos como o contrato de R$ 2.800.000,00 de Daiana Caruline Tasso de 18/09/2026).
   - Disponibilizar modal interativo e auditável (`CrmVendasFechadasModal`) ao clicar nos indicadores de vendas, exibindo cotas, parcelas, prazos, administradoras e atalhos diretos.

2. **Separação Canônica entre Crédito Pretendido e Parcela Mensal (Fase 258 - Parte B):**
   - Eliminar a ambiguidade histórica em que valores de parcelas de sorteios/eventos (ex: R$ 400, R$ 500, R$ 600, R$ 1.500) poluíam o valor de crédito do negócio no CRM (`valor_estimado` / `valor_credito`).
   - Adicionar a coluna dedicada `valor_parcela numeric(15, 2)` na tabela `public.leads`.
   - Realizar o backfill de saneamento automático no banco, movendo valores menores que R$ 3.500 para `valor_parcela` e corrigindo créditos reais de R$ 100.000+ para `valor_credito`.
   - Atualizar todos os pontos de entrada (Sorteios, Eventos, Simuladores, Calculadoras, Entrada Rápida, Edição de Lead, RPCs) para persistir e tratar ambos os valores separadamente.
   - Refatorar o Pipeline Kanban e o Funil 3D para consolidar e exibir tanto o volume de crédito pretendido quanto a soma de parcelas mensais em cada coluna.

3. **Customização Visual e Deconflito de Cores do Racon Sinop (Fase 258 - Parte C):**
   - Corrigir a desconfiguração visual do layout administrativo no parceiro `raconsinop.com.br` (`tenant-admin-racon`).
   - Substituir overrides genéricos por um design system corporativo claro de alto contraste:
     - Superfícies padrão limpas em `#ffffff` com bordas sutis `#e2e8f0` e tipografia nítida `#0f172a` / `#334155`.
     - Cards de Alerta da Fila Operacional e KPIs em tons pastéis elegantes e legíveis (`#f0f9ff`, `#f0fdf4`, `#fffbeb`, `#fef2f2`, `#fff7ed`, `#faf5ff`) com textos escuros em contraste WCAG AA/AAA.
     - Preservação integral do Módulo Executivo Escuro do Funil 3D (`.racon-funnel-executive`) em Navy Racon (`#0c2340` a `#071526`) com títulos brancos e métricas em neon verde/ciano.
     - Botões sólidos com texto branco preservado e botões contornados corporativos.

---

## 2. Implementação Técnica Detalhada

### 2.1. Banco de Dados (Supabase PostgreSQL)
- **Migration 241:**
  - Adição da coluna `public.leads.valor_parcela numeric(15, 2) null`.
  - Backfill automático de mais de 20 leads legados com parcelas na coluna de crédito.
  - Atualização da RPC `rpc_realizar_checkin_conversacional` para gravar `valor_parcela` e anular `valor_estimado`/`valor_credito` nos cadastros de eventos de sorteio.
  - Atualização da RPC `rpc_upsert_lead_por_telefone` para suportar `p_payload->>'valor_parcela'` e `p_payload->>'valor_credito'` de maneira isolada.

### 2.2. Camada de Aplicação e Ingressos
- **`src/lib/eventos-sorteio/cadastro.ts`:**
  - O valor selecionado no sorteio (ex: R$ 400/mês) é atribuído estritamente a `valor_parcela`, com `valor_credito: null` e `valor_estimado: null`.
- **`src/lib/crm/upsert-lead.ts`:**
  - Normalização e formatação cronológica de histórico distinguindo `Crédito pretendido: R$ X` e `Parcela mensal: R$ Y/mês`.
  - Atualização dos fallbacks client-side e da RPC.
- **`src/app/api/public/simulador/captura/route.ts` & `calculadoras/captura/route.ts`:**
  - Ingressam tanto `valor_credito` quanto `valor_parcela`.
- **`src/app/admin/leads/[id]/page.tsx` & `src/app/admin/leads/actions.ts`:**
  - Formulário administrativo de lead dividido em `Crédito Pretendido (R$)` e `Parcela Mensal (R$)`.
  - Ações `updateLeadAction` e `createLeadRapidoAction` tratam ambos os campos independentemente.
- **`src/components/admin/crm/crm-quick-lead-modal.tsx`:**
  - Modal de cadastro rápido enriquecido com campos dedicados para crédito pretendido e parcela mensal.

### 2.3. Visualização no Pipeline Kanban e Funil 3D
- **`src/components/admin/crm/crm-kanban-board.tsx`:**
  - O header de cada coluna calcula e exibe `Crédito: R$ X` e `Parcelas: R$ Y/mês`.
  - O banner de filtro ativo exibe a soma consolidada de créditos e parcelas.
- **`src/components/admin/crm/crm-lead-card.tsx`:**
  - Card exibe claramente `Crédito: R$ X` (ou "Crédito a definir") e `Parcela: R$ Y/mês` (ou "Parcela a definir").

### 2.4. Design System Racon Sinop (`globals.css`)
- **`.tenant-admin-racon`:**
  - Cards de alertas e status convertidos para paleta pastel com tipografia de alta legibilidade.
  - `.racon-funnel-executive` e `[data-theme-executive="dark"]` protegidos contra sobrescritas indevidas de cores.
  - Formulários com inputs brancos, bordas `#cbd5e1` e contraste nítido.

---

## 3. Validação e Homologação
- **TypeScript:** `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` -> 0 erros.
- **Vitest:** 303 arquivos de teste aprovados (1.653 testes unitários e de integração passando).
- **Next.js Production Build:** `npm run build` -> Compilou todas as 159 rotas estáticas e dinâmicas com sucesso.
