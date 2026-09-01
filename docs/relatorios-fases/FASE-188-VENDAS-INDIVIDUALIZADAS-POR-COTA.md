# Fase 188 — Vendas individualizadas por cota

## Incidente

A venda multicotas aparecia em uma única linha agregada. Embora as duas cotas
do cliente Janser já existissem no banco, a tela mostrava somente a primeira
para numeração e operação.

## Correção

- a listagem de vendas passa a gerar uma linha para cada registro de
  `cotas_definitivas`;
- crédito, parcela, prazo, número e status apresentados são os da própria cota;
- numeração, contemplação e cancelamento são acionados diretamente na cota da
  linha;
- os dados comerciais comuns da contratação continuam vinculados à venda pai,
  sem duplicar o valor total contratado;
- a consulta operacional foi marcada como não cacheável para sempre refletir
  cotas recém-materializadas.

## Validação dos dados

A venda do cliente Janser possui duas cotas definitivas ativas e distintas:

- cota 1: crédito R$ 127.200,00 e parcela R$ 484,63;
- cota 2: crédito R$ 127.200,00 e parcela R$ 484,63.

O total da venda permanece R$ 254.400,00, sem duplicidade financeira.
