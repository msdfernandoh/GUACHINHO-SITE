# Hotfix 285 — Reserva fiscal formada pelas comissões recebidas

## Regra financeira

- A reserva fiscal não usa previsões: ela soma os impostos persistidos nas parcelas de comissão que ficaram elegíveis após o recebimento da franquia. Liquidações parciais reservam apenas a proporção efetivamente recebida.
- O saldo da reserva é `impostos retidos nas comissões recebidas - guias marcadas para retirada da reserva` e pode evidenciar insuficiência de caixa no demonstrativo.
- O saldo bancário da PJ continua sendo um fato de caixa separado. O painel informa a cobertura disponível e o eventual déficit para que imposto reservado não seja confundido com caixa livre.

## Contas a pagar

- A coluna `retirar_reserva_impostos` em `financeiro_contas_pagar` é auditável e inicia como `false`.
- O cadastro e a edição da conta exibem o checkbox **Retirar da reserva de impostos da empresa ao pagar**. Somente uma guia marcada reduz o saldo fiscal; despesas tributárias antigas permanecem inalteradas até que alguém as marque explicitamente.

## Correção de dados de leitura

- A consulta de previsões da franquia deixou de requisitar a coluna inexistente `valor_pago` e passou a utilizar `valor_liquidado`, evitando o retorno silencioso de totais fiscais e comerciais zerados.
