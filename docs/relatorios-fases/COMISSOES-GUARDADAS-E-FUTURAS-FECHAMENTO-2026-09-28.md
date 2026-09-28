# Comissões guardadas e futuras no fechamento — 28/09/2026

## Entrega

Cada card de sócio no fechamento exibe duas listas mensais:

1. **Comissão já guardada:** pagamentos confirmados no período do fechamento, agrupados pelo mês de pagamento. A soma corresponde ao valor usado no acerto atual.
2. **Futura aguardando liberação:** previsões de comissão do sócio posteriores ao mês atual, ainda sem pagamento integral, agrupadas por competência.

As previsões futuras não entram no direito do fechamento, na divisão de despesas ou no saldo disponível. Elas são apresentadas somente para planejamento.

## Critérios

- Previsões canceladas são excluídas.
- O saldo futuro de cada previsão é `valor previsto − valor já pago`, nunca negativo.
- A associação é feita pelo participante comercial vinculado ao usuário do sócio dentro da empresa ativa.

## Validação

- Consultas reais confirmaram previsões futuras para Fernando e Eroni por competência.
- `npx tsc --noEmit` foi concluído sem erros.
