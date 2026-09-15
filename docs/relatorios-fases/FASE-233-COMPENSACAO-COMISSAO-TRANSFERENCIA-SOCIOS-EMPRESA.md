# Relatório de Conclusão — Fase 233: Compensação de Comissões com Transferência entre Sócios e Aporte para Conta da Empresa

**Data:** 15/09/2026  
**Status:** Concluído com Sucesso  
**Escopo:** `gauchinho-app/src/app/erp/conta-corrente-socios/actions.ts`, `gauchinho-app/src/components/erp/financeiro/conta-corrente-socios-view.tsx`, `gauchinho-app/src/lib/erp/conta-corrente-compensacao-destinos.test.ts`.

---

## 1. Contexto e Necessidade Operacional

O módulo de Conta-Corrente dos Sócios (`/erp/conta-corrente-socios`) possuía um modal restrito para compensação de comissões que exigia a seleção unitária de previsão por previsão, sem dar visibilidade do total recebido/disponível do sócio e sem permitir a destinação estratégica dos recursos:
1. **Equalização Direta entre Sócios (Opção A):** Quando um sócio pagou mais despesas que o outro (ex.: total de despesas R$ 30.000, Fernando pagou R$ 10.000 e Eroni R$ 20.000, gerando diferença de R$ 5.000 a pagar para o parceiro), o sócio devedor pode transferir comissões diretamente para o sócio credor, abatendo R$ 1 de dívida para cada R$ 1 transferido.
2. **Aporte para o Caixa da Empresa (Opção B):** Alternativamente, o sócio pode transferir o valor para uma conta bancária ou caixa da empresa para cobrir despesas futuras. No rateio societário 50/50, aportar R$ 10.000 na empresa iguala as contribuições totais de ambos os sócios (R$ 20.000 cada), quitando integralmente a diferença de R$ 5.000 e injetando R$ 10.000 de liquidez real no banco da empresa.

---

## 2. Entregas Realizadas

### 2.1 Backend & Modelagem Contábil (`actions.ts`)
1. **Contas Bancárias da Empresa e Saldos em Tempo Real:**
   - Adicionado `contasBancariasEmpresa` ao DTO `ContaCorrenteResumoDTO`.
   - Consulta integrada à view `financeiro_contas_saldos` e tabela `financeiro_contas_bancarias`.
2. **Fórmula Canônica de Equalização com Aportes:**
   - Aportes para contas da empresa somam-se às despesas pagas pessoalmente pelo sócio e geram responsabilidade rateada de forma simétrica (`responsabilidadeAportesSocio`), respeitando rigorosamente a equivalência matemática do exemplo dos sócios.
   - Transferências diretas entre sócios abatem peso-por-peso (`transfEnviadasSocioAtivo - transfRecebidasSocioAtivo`).
3. **Action `usarComissaoCompensarAction`:**
   - Suporte a seleção múltipla de previsões ou seleção integral com consumo FIFO em cascata.
   - Suporte a `tipo_destino`: `"TRANSFERENCIA_SOCIO"` ou `"CONTA_EMPRESA"`.
   - Registro em `financeiro_compensacoes_comissoes`.
   - Quando `TRANSFERENCIA_SOCIO`: registro em `financeiro_transferencias_socios` e lançamentos recíprocos no Ledger (`DEBITO` no sócio pagador e `CREDITO` no sócio recebedor).
   - Quando `CONTA_EMPRESA`: registro em `financeiro_conta_movimentos` com categoria `APORTE_SOCIO` (alimentando saldo bancário real) e lançamento de aporte no Ledger do sócio.

### 2.2 Interface do Usuário (`conta-corrente-socios-view.tsx`)
1. **Seleção e Resumo do Sócio Titular:**
   - Dropdown de sócio titular com atualização dinâmica de comissões e posição no período.
   - Cards com total de comissões disponíveis e saldo a compensar/crédito.
2. **Listagem Interativa de Comissões:**
   - Checkboxes individuais por previsão com detalhes (cliente, cota, parcela, competência, saldo disponível).
   - Botão "Selecionar Todas" / "Desmarcar Todas".
3. **Seleção de Destino em Cards Interativos:**
   - Card 1: "Transferir e Abater p/ Sócio" com seletor do sócio credor.
   - Card 2: "Conta / Caixa da Empresa" com seletor da conta bancária e exibição do saldo em tempo real.
4. **Atalhos Rápidos e Campo Aberto de Valor:**
   - Botão "Usar Todo Valor (R$ ...)".
   - Botão "Abater Dívida (R$ ...)" ou "Equalizar Aporte (R$ ...)".
   - Campo aberto para digitar qualquer valor desejado.
5. **Simulação em Tempo Real:**
   - Painel escuro com cálculo reativo: Dívida Atual, Valor Usado, Diferença Restante (destacando "100% Quitada!" quando atinge R$ 0,00), e Novo Saldo de Comissões / Entrada no Caixa.

---

## 3. Testes e Validação

1. **Testes Unitários:**
   - `src/lib/erp/conta-corrente-compensacao-destinos.test.ts`:
     - Validação matemática do caso canônico: R$ 30.000 pagos, Fernando R$ 10.000, Eroni R$ 20.000.
     - Transferência de R$ 5.000 para sócio -> diferença zerada.
     - Aporte de R$ 10.000 para empresa -> diferença zerada e empresa com R$ 10.000 em caixa.
     - Abatimentos parciais (R$ 3.000 transf e R$ 4.000 aporte).
     - Alocação FIFO de previsões.
   - Total de 17 arquivos e 98 testes executados com 100% de aprovação.
2. **Lint:**
   - `npm run lint:errors` executado com zero erros.
