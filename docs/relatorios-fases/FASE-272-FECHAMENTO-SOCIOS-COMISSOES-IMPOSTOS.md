# Fase 272 — Fechamento simples de sócios, comissões e impostos

## Objetivo

Tornar a Conta-Corrente dos Sócios compreensível sem conhecimento contábil e
evitar que uma comissão prevista seja usada como se já fosse dinheiro.

## Regras aplicadas

1. A comissão continua pertencendo ao seu titular, mesmo quando o dinheiro
   transita pela conta do outro sócio ou pela conta PJ.
2. O imposto é separado antes de apresentar valor livre para despesa, retenção
   ou saque. A responsabilidade fiscal fica visível por titular.
3. Laura, Enos e outros vendedores que não são sócios entram no resumo fiscal
   como vendedores da empresa; seus valores não entram no rateio societário.
   O painel mostra a conta visível: comissão líquida recebida pela PJ menos
   repasses aos vendedores não sócios = receita que ficou para a empresa,
   antes das despesas gerais.
4. Somente comissão elegível/confirmada com saldo pode compensar despesa.
   Previsões continuam informativas e não podem gerar transferência.
5. A visão sem filtro é realmente consolidada. O seletor de sócio passa a
   carregar a visão individual, sem escolher silenciosamente o primeiro sócio.
6. A conversão de valores aceita os formatos brasileiros `7.486,51` e técnico
   `7486.51`, sem multiplicar centavos.

## Auditoria e preservação

Nenhuma comissão, pagamento, conta, reserva ou lançamento histórico foi
alterado. As mudanças são de leitura, proteção da ação futura e explicação.
O lançamento existente continua rastreável; sua origem econômica é atribuída
ao titular informado na descrição, sem usar valor fixo no código.

## Validação

- `npm run lint:errors` — aprovado.
- A compensação no servidor rejeita previsão sem elegibilidade.
- A interface lista somente saldos confirmados na ação de compensar.
