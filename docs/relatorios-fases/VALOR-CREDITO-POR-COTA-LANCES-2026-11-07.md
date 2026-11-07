# Valor de crédito por cota em Lances e Estratégias — 07/11/2026

## Diagnóstico

Alguns legados gravaram o valor total contratado da venda em cada linha de
cota. No grupo 1553, por exemplo, 14 cotas apareciam com R$ 2.800.000,00,
embora o total correspondesse às 14 cotas.

## Correção

O módulo de Lances e Estratégias passou a calcular o valor operacional da cota
a partir do `snapshot_cota` somente quando ele comprovar que o valor repetido é
o total da venda (`valor_credito_total_venda` e `quantidade_cotas`). Registros
que já possuem o valor individual permanecem inalterados. O mesmo valor por
cota é usado na tela e no cálculo dos valores de lance.

## Validação

O grupo 1553 passa a exibir R$ 200.000,00 por cota (R$ 2.800.000,00 / 14),
enquanto registros como cotas de R$ 127.200,00 permanecem com seu valor
individual. TypeScript e build serão executados após a alteração.
