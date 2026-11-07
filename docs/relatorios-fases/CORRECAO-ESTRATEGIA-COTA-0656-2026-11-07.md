# Correção da estratégia da cota 0656 — 07/11/2026

## Diagnóstico

A estratégia da cota 0656 estava gravada corretamente no banco com `ativa = true`,
mas a tabela permanecia visualmente inativa porque o componente mantinha uma
cópia antiga de `initialRows` mesmo depois de `router.refresh()`.

Também foi identificado o cadastro legado `LANCE FIXO 255` no grupo 1553. O
parser interpretava o dígito 2 do texto como 2º lance fixo.

## Correção

- A tela passou a consumir as props atualizadas após o refresh.
- A identificação de 2º lance exige a palavra `SEGUNDO` ou um token isolado
  `2`, evitando confundir percentuais como 25%.
- O cadastro do grupo 1553 foi corrigido para `LANCE FIXO 25%`.

## Validação

A estratégia da cota 0656 foi confirmada no banco com `ativa = true`, lance
livre ativo e estratégia persistida. TypeScript e build de produção foram
executados após a correção.
