# Edição da data de pagamento no fechamento — 30/09/2026

## Entrega

O formulário **Editar conta** da lista de despesas no fechamento dos sócios passa a exibir a **Data do pagamento**. Ao salvar, a data `pago_em` da conta paga é atualizada e a despesa passa automaticamente ao mês correspondente no painel.

A action valida a empresa ativa, exige que a conta esteja paga, aceita somente data válida e impede data futura. O gatilho de fechamento societário continua impedindo mudanças em períodos já lacrados.

## Validação

TypeScript e build de produção executados em `gauchinho-app`.
