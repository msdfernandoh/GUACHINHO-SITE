# Relatório de Fase 234 — Reorganização Definitiva da Tela Conta-Corrente dos Sócios

**Data de Conclusão:** 15 de Setembro de 2026  
**Módulo:** ERP Financeiro / Conta-Corrente dos Sócios  
**Escopo:** `gauchinho-app/src/app/erp/conta-corrente-socios` e `src/components/erp/financeiro`  
**Tenant Homologado:** Gauchinho Consórcios (`7170f38e-15dd-4b19-8588-51e9a9cf0d4c`)  
**Quadro Societário:** Fernando Hugo (50%) & Eroni Bolfe (50%)

---

## 1. Contexto e Objetivo Principal

Transformar a tela `/erp/conta-corrente-socios` em uma central financeira simples, executiva e cristalina para os sócios.
Ao abrir a tela, os sócios precisam entender instantaneamente:
1. Quanto Fernando colocou efetivamente na operação.
2. Quanto Eroni colocou efetivamente na operação.
3. Quanto das despesas **JÁ PAGAS** era responsabilidade de cada um (50% / 50%).
4. Quem tem crédito e quem precisa compensar **HOJE**.
5. Quanto cada sócio possui de dinheiro/comissão deixado dentro da empresa (**Saldo Mantido**).
6. Quanto existe de **Caixa Livre Real** da empresa (Conta PJ sem reservas).
7. Quanto existe separado para impostos (**Reserva Fiscal**).
8. Quais contas já estão **LANÇADAS** e ainda não foram pagas no mês.
9. Quanto falta financiar para pagar essas contas (**Caixa Livre < Contas Lançadas**).
10. Quanto Fernando e Eroni precisarão deixar ou transferir para cobrir o déficit.
11. Quais valores são apenas **PREVISÕES FUTURAS** (30/60/90 dias) e não representam dívida real imediata.

---

## 2. Regra de Ouro dos Três Estágios Financeiros

A arquitetura estabelece a segregação estrita entre 3 estágios financeiros independentes:

```
┌────────────────────────────────────────────────────────────────────────┐
│ ESTÁGIO 1: CONTA PAGA (ACERTO ENTRE SÓCIOS)                           │
│  - Liquidadas do bolso ou com recurso de comissão retida.              │
│  - Fernando: R$ 19.090,61 (Próprio R$ 9.790,61 + Comissão R$ 9.300,00) │
│  - Eroni: R$ 17.332,37 (Próprio R$ 26.632,37 - R$ 9.300,00)            │
│  - Responsabilidade 50%: R$ 18.211,49 cada sócio.                     │
│  - Resultado: Fernando CRÉDITO +R$ 879,12 | Eroni COMPENSAR -R$ 879,12│
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ NÃO SE MISTURA
┌────────────────────────────────────────────────────────────────────────┐
│ ESTÁGIO 2: CONTA LANÇADA (A PAGAR NO MÊS VIGENTE)                     │
│  - Boletos/obrigações já lançadas no ERP a vencer no mês: R$ 14.538,02 │
│  - (-) Caixa Livre PJ Disponível: R$ 4.016,13                         │
│  - (=) Falta Financiar: R$ 10.521,89 (R$ 5.260,95 para cada sócio)    │
│  - Status de cobertura: Déficit para ambos se saldo mantido for zero   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ NÃO SE MISTURA
┌────────────────────────────────────────────────────────────────────────┐
│ ESTÁGIO 3: PREVISÃO FUTURA (PLANEJAMENTO ORÇAMENTÁRIO)                 │
│  - Projeções de 30 dias (R$ 15.000), 60 dias e 90 dias.                │
│  - Aluguel futuro, folha futura, estimativas contratuais.              │
│  - NÃO é dívida líquida imediata nem altera o caixa de hoje.           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. O Caso dos R$ 9.300 Reconciliado (Origem Econômica vs Pagador Operacional)

- **Problema Histórico Identificado:** Das 67 contas pagas (R$ 36.422,98), 47 foram executadas por Eroni Bolfe (R$ 26.632,37) e 20 por Fernando Hugo (R$ 9.790,61). No entanto, **R$ 9.300,00** pagos por Eroni vieram de comissões de Fernando Hugo retidas na empresa para custear a operação.
- **Solução Arquitetural:**
  - Distinção entre `pagador_operacional` (quem fez o Pix) e `origem_recurso_economico` (de quem era o dinheiro).
  - Fernando forneceu R$ 9.790,61 (direto) + R$ 9.300,00 (comissão retida) = **R$ 19.090,61**.
  - Eroni forneceu R$ 26.632,37 - R$ 9.300,00 = **R$ 17.332,37**.
  - Rateio 50/50 em R$ 36.422,98 = **R$ 18.211,49** para cada sócio.
  - **Saldo Realizado Fernando:** $19.090,61 - 18.211,49 = \mathbf{+R\$\ 879,12}$ (**CRÉDITO NO ACERTO**).
  - **Saldo Realizado Eroni:** $17.332,37 - 18.211,49 = \mathbf{-R\$\ 879,12}$ (**PRECISA COMPENSAR A FERNANDO**).
  - A tela exibe um **Banner de Reconciliação Histórica** com confirmação de um clique chamando `classificarOrigemHistoricaAction`.

---

## 4. Estrutura da Nova Interface (Layout e Componentes)

### 4.1. Faixa de Topo — Resumo Executivo (HOJE)
Apresenta imediatamente os 6 números vitais ao abrir a página:
1. **Card 1: Fernando Hugo** — `+R$ 879,12` (Badge Verde: CRÉDITO NO ACERTO, botão *Ver Composição*).
2. **Card 2: Eroni Bolfe** — `-R$ 879,12` (Badge Rose: PRECISA COMPENSAR, botão *Ver Composição*).
3. **Card 3: Caixa Livre PJ** — `R$ 4.016,13` (Saldo Bancário PJ Gauchinho Empresa sem reservas, botão *Ver Detalhes PJ*).
4. **Card 4: Contas Lançadas Mês** — `R$ 14.538,02` (Boletos a pagar no mês 09/2026, botão *Ver Contas*).
5. **Card 5: Falta Financiar** — `R$ 10.521,89` (Déficit do mês: R$ 5.260,95 para cada sócio, botão *Rateio Necessário*).
6. **Card 6: Reserva de Impostos** — `R$ 0,00` (Controle do Simples Nacional/DAS, botão *Ver Controle*).

### 4.2. Os 7 Blocos Estruturados
- **Bloco 1 — Acerto entre Sócios (Contas Já Pagas):** Colunas comparativas Fernando vs Eroni com Responsabilidade 50%, Dinheiro Próprio, Comissão Utilizada, Aportes, Total Colocado, Saldo Líquido e Instrução de Compensação Imediata.
- **Bloco 2 — Saldos Mantidos na Empresa (Comissão/Aporte):** Recursos retidos voluntariamente para capital de giro sem gerar transferências bancárias fictícias (PIX fictício proibido). Botão `[+ Deixar Comissão na Empresa]`.
- **Bloco 3 — Caixa da Empresa (PJ Real):** Saldo Bancário Oficial PJ deduzindo reservas tributárias e fixas, com segregação expressa das contas bancárias particulares (Eroni PF: R$ 23.274,67; Fernando PF: R$ 9.717,89).
- **Bloco 4 — Contas Lançadas (A Pagar no Mês):** Cards por vencimento (Vencidas, Hoje, Próximos 7 dias, Restante do Mês), diagnóstico de cobertura individual (Fernando Déficit R$ 5.260,95; Eroni Déficit R$ 5.260,95), e tabela das contas do mês com botão `[Pagar / Baixar]`.
- **Bloco 5 — Reserva de Impostos (Controle Fiscal):** Retenção das comissões, impostos pagos, saldo atual em reserva, guias lançadas e necessidade adicional.
- **Bloco 6 — Previsões Futuras (30/60/90 Dias):** Projeções orçamentárias com carimbo explícito de "NÃO É DÍVIDA REAL IMEDIATA".
- **Bloco 7 — Extrato e Auditoria (Ledger Imutável):** Trilha contábil double-entry auditável de todas as transações, amortizações e retenções.

### 4.3. Modais Interativos Implementados
1. **Modal de Drill-Down ("Ver Composição"):** Explicação item a item de cada indicador (Fernando, Eroni, Caixa Livre, Contas Lançadas, Impostos).
2. **Modal "Deixar Comissão na Empresa":** Formulário sem movimentação física fictícia, alimentando o controle interno de saldo mantido do sócio (`deixarComissaoNaEmpresaAction`).
3. **Modal "Baixa Inteligente com Origem de Recurso":** Permite definir o pagador operacional (`EMPRESA`, `ERONI`, `FERNANDO`) e a origem econômica (`CAIXA_EMPRESA`, `DINHEIRO_PROPRIO`, `COMISSAO_RETIDA`, `SALDO_MANTIDO`, `RESERVA_IMPOSTOS`) chamando `salvarBaixaContaComOrigemAction`.

---

## 5. Arquivos Modificados e Criados

| Arquivo | Descrição da Alteração |
|---|---|
| `supabase/migrations/223_conta_corrente_origem_recurso_estagios.sql` | Colunas de origem econômica em `financeiro_contas_pagar`, tipos de ledger e tabela `financeiro_ajustes_classificacao_historica`. |
| `gauchinho-app/src/app/erp/conta-corrente-socios/actions.ts` | Implementação dos DTOs dos 7 blocos, cálculo da Faixa de Topo (HOJE), reconciliação dos R$ 9.300 e 3 novas Server Actions (`classificarOrigemHistoricaAction`, `deixarComissaoNaEmpresaAction`, `salvarBaixaContaComOrigemAction`). |
| `gauchinho-app/src/components/erp/financeiro/conta-corrente-central-socios.tsx` | **[NOVO]** Componente completo da Central dos Sócios com os 7 blocos, Faixa de Topo (HOJE), Banner de Classificação Histórica e os 3 Modais operacionais. |
| `gauchinho-app/src/components/erp/financeiro/conta-corrente-socios-view.tsx` | Integração de `ContaCorrenteCentralSocios` como aba padrão e view principal ("Central dos Sócios (7 Blocos)"), preservando abas detalhadas sem poluição visual. |
| `gauchinho-app/src/lib/erp/conta-corrente-socios.test.ts` | Adicionado Bloco 7 com 5 novos testes unitários validando o caso canônico, números de produção, isolamento absoluto de estágios e retenção de comissão. |

---

## 6. Resultados dos Testes Automatizados

Execução via Vitest:
```
✓ src/lib/erp/conta-corrente-socios.test.ts (27 tests)
  ✓ Caso Canônico Obrigatório: R$ 35.800 de despesas pagas com R$ 9.300 de comissão de Fernando executada por Eroni
  ✓ Caso Real de Produção: R$ 36.422,98 pagos, Eroni executou 26.632,37 com 9.300 de comissão de Fernando
  ✓ Isolamento Absoluto de Estágios: Adicionar R$ 20.000 em contas abertas (Estágio 2) NÃO altera o saldo do acerto (Estágio 1)
  ✓ Isolamento de Previsões Futuras (Estágio 3): Previsões de 30/60/90 dias não alteram acerto nem contas lançadas de hoje
  ✓ Retenção de Comissão na Empresa: Alimenta Saldo Mantido sem gerar movimentação bancária fictícia
✓ src/lib/erp/conta-corrente-compensacao-destinos.test.ts (7 tests)
✓ src/lib/erp/conta-corrente-periodos.test.ts (12 tests)

Test Files  3 passed (3)
Tests       46 passed (46)
Duration    513ms
```

Compilação TypeScript (`npx tsc --noEmit`):
- **0 erros** nos arquivos da feature (`actions.ts`, `conta-corrente-socios-view.tsx`, `conta-corrente-central-socios.tsx`, `conta-corrente-socios.test.ts`).

---

## 7. Conformidade com as Regras de Governança

- [x] **Escopo Estrito:** Operação 100% contida em `GAUCHINHO SITE`. Nenhum acesso a `CONSORCIO-SISTEMA`.
- [x] **Preservação de Dados:** Todas as 67 contas pagas e 59 abertas preservadas integralmente.
- [x] **Multi-tenancy:** Filtragem obrigatória por `empresa_id` em todas as consultas e mutations.
- [x] **Relatório de Fase:** Criado em `docs/relatorios-fases/FASE-234-REORGANIZACAO-DEFINITIVA-CONTA-CORRENTE-SOCIOS.md`.
