# Fase 247 — Módulo Executivo de Funil 3D & Métricas Estratégicas (Crédito, Parcela e Leads)

Data: 19/09/2026

## 1. Contexto e Objetivo

Atendendo à demanda da diretoria comercial por uma visualização mais agressiva e executiva do funil de vendas, foi desenvolvido um novo módulo dimensional de alta performance para o dashboard do CRM (`/admin/crm`).

Inspirado nos diagramas de funil estratificado 3D (geometria trapezoidal/cônica em perspectiva) com fitas/legendas conectadas no formato ribbon/puzzle, o novo módulo unifica as três informações comerciais essenciais em cada nível da esteira:
1. **Valor de Crédito Total (R$)**
2. **Valor da Parcela Mensal Recorrente Estimada/Fechada (R$/mês)**
3. **Volume de Leads / Oportunidades (e percentual relativo)**

---

## 2. Modelagem e Agregação de Dados (`src/lib/crm/dashboard-query.ts`)

- **Cálculo da Parcela por Lead (`extrairValorParcelaLead`)**:
  - Prioridade 1: Parcela real de fechamento (`valor_parcela_fechamento`), quando preenchida na esteira de formalização.
  - Prioridade 2: Parcela extraída de `dados_simulacao.resultado` (`parcela`, `valorParcela`, `parcelaReduzida`, `parcelaIntegral`).
  - Prioridade 3: Projeção financeira canônica de consórcio: `(crédito * 1.18 taxa adm média) / prazo_simulado` (com fallback para 160 meses caso não informado).
- **Macro-Níveis Estratégicos (`CrmFunilMacroTier`)**:
  - **Nível 1 (Topo Funil — Visitante & Lead)**: `novo_lead` + `contato_realizado` (Captação, descoberta e primeiro contato).
  - **Nível 2 (Topo-Meio — Lead Qualificado)**: `qualificado` + `reuniao_agendada` + `reuniao_realizada` (Diagnóstico de perfil e reuniões).
  - **Nível 3 (Meio Funil — Oportunidade em Negociação)**: `proposta_enviada` + `documentacao_cadastro` + `boleto_enviado` (Propostas ativas, lances e documentação).
  - **Nível 4 (Fundo Funil — Venda Concretizada)**: `venda_fechada` + `pos_venda` (Cotas ativadas, faturamento e clientes conquistados).
- **Taxas de Passagem**: Percentual de avanço de oportunidades entre cada camada sucessiva do funil.
- **Totais Globais e Alertas de Recuperação**: Total de crédito em trânsito, parcelas mensais acumuladas, ticket médio e montantes recuperáveis de leads em *Perdido* e *Stand-by*.

---

## 3. Componente Visual 3D (`src/components/admin/crm/crm-funnel-3d-visual.tsx`)

- **Geometria 3D SVG**:
  - Boca elíptica dimensional e 4 trapézios concêntricos que afunilam gradativamente até a ponta de conversão.
  - Iluminação por facetas laterais e gradientes neon vibrantes (Roxo/Índigo, Ciano/Turquesa, Coral/Rose, Dourado/Esmeralda).
  - Indicadores flutuantes de taxa de avanço entre as camadas.
- **Legendas Ribbon Conectadas (Estilo Puzzle)**:
  - Abas horizontais com encaixe cromático conectado ao funil.
  - Badges de alto contraste para **Valor Crédito**, **Valor Parcela** e **Oportunidades**.
  - Emblemas circulares com ícones expressivos: `Eye` (Descoberta), `Mail` (Qualificação), `Magnet` (Oportunidade) e `Handshake` (Venda Concretizada).
- **Controles Interativos**:
  - Efeito hover sincronizado entre a fatia do funil e o ribbon correspondente.
  - Seletor de modo: **Visão Macro 3D (4 Fases)** vs **Visão Detalhada (12 Etapas)**.
  - Rodapé de recuperação com link direto para reaquecer leads perdidos no pipeline.

---

## 4. Integração no Dashboard (`src/components/admin/crm/crm-funnel-dashboard.tsx`)

- Posicionado logo abaixo dos 8 KPIs e alertas operacionais, e acima do gráfico de barras horizontais tradicional, preservando a visão existente e agregando o visual de impacto solicitado.
- O gráfico horizontal tradicional também foi enriquecido com a coluna de parcelas mensais (`/mês`).

---

## 5. Validação e Qualidade

- **Testes Unitários:** `src/lib/crm/crm.test.ts` e suíte completa em `src/lib/crm` executados com **24/24 testes aprovados (100%)**.
- **TypeScript:** `npx tsc --noEmit` executado com **0 erros**.
- **ESLint:** `npm run lint:errors` executado com **0 erros**.
