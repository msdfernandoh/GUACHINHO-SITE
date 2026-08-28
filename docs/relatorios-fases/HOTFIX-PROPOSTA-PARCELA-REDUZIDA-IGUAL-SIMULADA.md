# Hotfix — parcela reduzida da proposta igual à parcela simulada

## Problema

Quando a simulação de grupos usava parcela reduzida com seguro, a proposta
exibia a “Parcela inicial estimada” com o seguro, mas mostrava em “Parcela
reduzida” apenas a base reduzida sem seguro. Os dois campos descreviam a mesma
primeira parcela escolhida com valores diferentes.

## Regra aplicada

Para modalidade reduzida ou personalizada, a parcela reduzida apresentada na
proposta é exatamente a `primeiraParcela` do snapshot da simulação:

- com seguro selecionado, ambos os campos incluem o seguro;
- sem seguro selecionado, ambos os campos permanecem sem seguro;
- o percentual, como 60%, continua identificando a modalidade e é calculado
  sobre as bases unitárias integral e reduzida, sem incorporar o seguro.

Snapshots antigos também são corrigidos durante a leitura quando preservam a
modalidade e a primeira parcela. Não houve migration ou alteração de dados.

## Validação

- cenário de duas cotas com seguro: estimada e reduzida em R$ 2.255,04;
- cenário de duas cotas sem seguro: estimada e reduzida em R$ 2.088,00;
- suíte completa, ESLint direcionado e build de produção executados.
