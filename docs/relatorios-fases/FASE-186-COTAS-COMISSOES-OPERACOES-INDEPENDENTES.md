# Fase 186 — Cotas, comissões e operações independentes

## Incidente

A formalização de duas cotas materializava dois registros em
`cotas_definitivas`, mas o motor canônico havia criado todas as previsões de
comissão somente para a primeira. A listagem agregada da venda mostrava apenas a
primeira cota e reforçava a impressão de que existia uma única operação.

## Correção

- cada etapa de comissão da franquia e dos participantes é distribuída entre as
  cotas, com um registro próprio por cota;
- a divisão preserva o total original e atribui eventual centavo residual à
  última cota;
- contemplação, antecipação e cancelamento filtram `cota_definitiva_id`;
- a venda só fica cancelada quando todas as suas cotas estiverem canceladas;
- a listagem da venda exibe todas as cotas e oferece ações identificadas por
  ordem;
- um trigger efetua a distribuição quando a última cota da venda é criada;
- vendas multicotas existentes sem movimentação são reconciliadas pela migration
  `183_comissoes_independentes_por_cota.sql`.

## Segurança

Previsões já liquidadas, elegíveis ou pagas não são redistribuídas
automaticamente. A rotina é idempotente e registra em `snapshot_regra` a origem,
a ordem da cota, a quantidade e o total anterior.

## Validação em produção

- migration `183` registrada local e remotamente;
- contratação afetada confirmada com duas cotas definitivas distintas, cada uma
  com crédito de R$ 127.200,00, parcela de R$ 484,63 e identidade própria;
- cronograma da franquia: 20 registros, 10 por cota;
- cronograma do participante: 20 registros, 10 por cota;
- total preservado nos dois cronogramas: R$ 10.176,00.
