# Relatório de Fase 252 — Funil 3D Interativo e Clicável com Filtro Direto no Pipeline Kanban

**Data:** 21/09/2026  
**Módulo:** CRM & Gestão Comercial de Vendas (Área Logada Staff/Admin)  
**Ambiente:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Supabase Postgres  
**Empresa Referência:** Gauchinho Consórcios (Tenant 1 — `7170f38e-15dd-4b19-8588-51e9a9cf0d4c`)  
**Status:** CONCLUÍDO (Testes Vitest: 31/31 aprovados, TypeScript check: 0 erros, Lint: 0 erros)

---

## 1. Contexto e Necessidade

Com a entrega do Módulo Executivo de Funil 3D (Fase 247) no Dashboard Comercial (`/admin/crm`), os gestores e consultores passaram a visualizar as três métricas essenciais do pipeline (Crédito Total, Parcela Mensal Estimada e Volume de Leads) em um formato gráfico geométrico tridimensional estratificado em 4 macro fases:
- **Topo Funil (Visitante & Lead):** `novo_lead`, `contato_realizado`
- **Topo-Meio (Lead Qualificado):** `qualificado`, `reuniao_agendada`, `reuniao_realizada`
- **Meio Funil (Oportunidade):** `proposta_enviada`, `documentacao_cadastro`, `boleto_enviado`
- **Fundo Funil (Venda Fechada):** `venda_fechada`, `pos_venda`

No entanto, a navegação entre a visão estratégica do funil e a execução operacional no **Pipeline Kanban** (`/admin/crm/pipeline`) ainda exigia passos manuais: ao analisar uma etapa com alto volume ou gargalo no funil, o usuário precisava ir para o pipeline e rolar manualmente entre 12 colunas horizontais para localizar e filtrar os leads.

A demanda desta fase foi tornar **100% dos elementos do funil interativos e clicáveis**:
> *"ao clicar deve levar para o pipeline funil com o filtro da etapa clicada"*

---

## 2. Solução Implementada

### 2.1. Centralização Canônica das Fases Macro (`src/lib/crm/constants.ts`)
- Criação da constante compartilhada `CRM_MACRO_TIERS`, eliminando duplicações e unificando as 4 macro fases com cores, gradientes, ícones, conceitos e slugs de etapas vinculadas.
- Helpers de resolução:
  - `getMacroTierByFase(faseOrSlug)`: resolve a macro fase de forma case-insensitive e tolerante a variações.
  - `isEtapaInMacroTier(etapaSlug, fase)`: verifica se uma etapa canônica pertence àquela macro fase.

### 2.2. Funil 3D Interativo e Clicável (`src/components/admin/crm/crm-funnel-3d-visual.tsx`)
1. **Camadas SVG 3D (Lado Esquerdo):**
   - Cada um dos 4 trapézios do funil geométrico possui atributos semânticos (`role="button"`, `tabIndex={0}`, `aria-label`, suporte a tecla Enter/Espaço).
   - Efeito visual de hover aprimorado com contorno luminoso proporcional à cor da fase e texto interno dinâmico indicando `➔ Clique para abrir no Pipeline`.
   - Clique redireciona imediatamente para `/admin/crm/pipeline?fase=topo`, `?fase=meio_sup`, `?fase=meio_inf` ou `?fase=fundo`.
2. **Cartões Ribbon Conectados (Lado Direito):**
   - O corpo do cartão tornou-se clicável com elevação, anel de realce e botão CTA `Pipeline →`.
   - **Sub-etapas em Chips Individuais:** Os nomes das etapas incluídas (ex: *Novo lead*, *Contato realizado*) foram transformados em botões com parada de propagação (`e.stopPropagation()`), permitindo ao usuário filtrar a macro fase inteira (clicando no cartão) ou uma etapa específica (clicando no chip correspondente).
3. **Visão Detalhada (12 Etapas):**
   - Cada uma das 12 linhas analíticas é totalmente clicável, com indicador de seta `ArrowRight` no hover e navegação para `/admin/crm/pipeline?etapa=${etapa.slug}`.
4. **Rodapé de Recuperação:**
   - Links diretos para "Leads Perdidos / Desqualificados" (`?etapa=perdido`) e "Oportunidades em Stand-by" (`?etapa=standby_futuro`).

### 2.3. Funil Horizontal Tradicional (`src/components/admin/crm/crm-funnel-dashboard.tsx`)
- Todas as barras de progresso horizontais tradicionais foram transformadas em links de linha completa para `/admin/crm/pipeline?etapa=${etapa.slug}`.

### 2.4. Pipeline Kanban com Filtro, Banner Ativo e Modo Foco (`src/components/admin/crm/crm-kanban-board.tsx`)
1. **Recepção dos Parâmetros:**
   - Suporte a `initialStageFilter` recebido via `searchParams` (`?fase=...`, `?etapa=...`, `?etapa_id=...`, `?perdidos=1`).
2. **Banner de Filtro Ativo (`CrmStageFilterBanner`):**
   - Exibido logo acima das colunas quando um filtro de funil ou etapa estiver ativo.
   - Apresenta:
     - Badge de cor e identificação clara da fase ou etapa ativa.
     - Métricas consolidadas: Contagem de Oportunidades, Montante de Crédito e Parcelas Mensais Estimadas.
     - Botão de alternância: **"👁️ Focar nestas colunas"** vs **"📋 Ver todas as 12 colunas"**.
     - Botão **"✕ Limpar Filtro"** que restaura o quadro completo em tempo real.
3. **Modo Foco vs Todas as Colunas:**
   - Em **Modo Foco** (ativado por padrão ao vir de um clique no funil), o Kanban exibe apenas as colunas relevantes (ex: apenas as 2 colunas do Topo Funil, ou apenas a coluna Qualificado), permitindo visualização espaçosa e sem rolagem horizontal excessiva.
   - Em **Modo Todas as Colunas**, o Kanban exibe as 12 colunas canônicas, destacando as colunas ativas com anel luminoso (`ring-2 ring-blue-500`) e badge `Ativa`, rolando suavemente para a coluna filtrada (`scrollIntoView`).
4. **Seletor de Etapas na Toolbar:**
   - Dropdown agrupado (`🎯 Filtrar por Etapa / Nível`) contendo todas as 12 etapas e as 6 categorias estratégicas (Macro 3D, Perdidos e Stand-by), com atualização de URL via `router.replace(..., { scroll: false })` sem recarregamento de página.

### 2.5. Consulta do Pipeline no Servidor (`src/app/admin/crm/pipeline/page.tsx`)
- Para garantir que leads legados do Tenant 1 (cujo status em texto ainda não possuía `etapa_id` preenchido) não sejam excluídos prematuramente pelo SQL, `queryLeadsForKanban` carrega o pool ativo da empresa e o `CrmKanbanBoard` aplica a correspondência em memória, assegurando consistência de 100% com os totais exibidos no Dashboard.

---

## 3. Arquivos Modificados e Criados

| Arquivo | Natureza | Descrição |
|---------|----------|-----------|
| `gauchinho-app/src/lib/crm/constants.ts` | Modificação | Adição de `CRM_MACRO_TIERS`, `getMacroTierByFase`, `isEtapaInMacroTier`. |
| `gauchinho-app/src/lib/crm/types.ts` | Modificação | Inclusão de `etapa`, `fase` e `etapa_slug` no tipo `LeadFilters`. |
| `gauchinho-app/src/lib/crm/dashboard-query.ts` | Modificação | Reutilização de `CRM_MACRO_TIERS` e inclusão de `etapasSlugs` no `CrmFunilMacroTier`. |
| `gauchinho-app/src/components/admin/crm/crm-funnel-3d-visual.tsx` | Modificação | Camadas SVG, ribbons, chips de sub-etapas e lista detalhada 100% clicáveis. |
| `gauchinho-app/src/components/admin/crm/crm-funnel-dashboard.tsx` | Modificação | Linhas do funil horizontal tradicional transformadas em links para o pipeline. |
| `gauchinho-app/src/app/admin/crm/pipeline/page.tsx` | Modificação | Extração dos parâmetros de etapa/fase e passagem de `initialStageFilter` para o board. |
| `gauchinho-app/src/components/admin/crm/crm-kanban-board.tsx` | Modificação | Banner de filtro ativo, modo foco, seletor de etapa e rolagem suave. |
| `gauchinho-app/src/lib/crm/crm.test.ts` | Modificação | 4 novos testes unitários validando correspondência de fases macro e etapas. |
| `gauchinho-app/src/app/manifest.ts` | Correção | Ajuste de tipagem do atributo `purpose` dos ícones no manifesto PWA. |
| `docs/relatorios-fases/FASE-252-FUNIL-3D-INTERATIVO-FILTRO-PIPELINE-KANBAN.md` | Criação | Relatório técnico oficial da fase. |

---

## 4. Validação e Qualidade de Código

- **Testes Unitários:**
  `npm --prefix gauchinho-app test -- run src/lib/crm`  
  **Resultado:** 5 arquivos de teste, **31/31 testes aprovados**.
- **TypeScript:**
  `node gauchinho-app/node_modules/typescript/bin/tsc --noEmit -p gauchinho-app/tsconfig.json`  
  **Resultado:** **0 erros** de compilação.
- **ESLint:**
  `npm --prefix gauchinho-app run lint:errors`  
  **Resultado:** **0 erros**.
