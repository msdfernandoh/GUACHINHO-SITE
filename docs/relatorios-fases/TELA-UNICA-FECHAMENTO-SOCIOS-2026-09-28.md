# Tela única de fechamento dos sócios — 28/09/2026

## Decisão

O ERP passa a apresentar somente **Fechamento dos Sócios** como tela de decisão, conferência e lacre. A antiga rota `/erp/conta-corrente-socios` faz redirecionamento interno para `/erp/fechamento-socios`.

## Preservação

Nenhum lançamento, saldo, ledger, conta, comissão ou fechamento foi removido. As actions e os dados históricos da conta-corrente permanecem para sustentar o cálculo e a auditoria do fechamento; apenas a interface duplicada deixou de ser exibida.

## Navegação

- O menu lateral agora mostra “Fechamento dos sócios”.
- Financeiro & Caixa abre o mesmo painel pelo botão e pelo bloco de contas internas.
- Links antigos continuam funcionando e chegam ao painel único.

## Validação

O redirecionamento é feito no servidor pela rota antiga e mantém a permissão financeira já exigida dentro do painel de fechamento.
