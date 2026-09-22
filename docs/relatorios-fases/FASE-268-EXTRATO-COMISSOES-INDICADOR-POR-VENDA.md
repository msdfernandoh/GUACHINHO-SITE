# Fase 268 — Extrato de comissões do indicador por venda

## Objetivo

Transformar a lista de lançamentos isolados da área **Minhas comissões** em um
extrato comercial legível por venda, sem replicar ou recalcular o motor de
comissões no aplicativo.

## Entrega

- As previsões são agrupadas por `venda_id`.
- Cada cartão informa o nome do comprador, crédito vendido, comissão bruta da
  franqueadora, imposto, base líquida e percentual aplicado ao indicador.
- A comissão do indicador corresponde à soma das previsões já gravadas para a
  venda. Exemplo: R$ 40.000,00 menos 17,5% resulta em R$ 33.000,00 de base;
  12,5% resulta em R$ 4.125,00, apresentada nas parcelas configuradas no ERP.
- As parcelas são ordenadas pela etapa oficial e mostram valor, status e a
  previsão de até 30 dias por etapa após a data da venda. Na ausência de data
  de conclusão, a competência histórica permanece visível.
- A confirmação de recebimento continua usando a mesma Server Action e o RPC
  canônico já existente.

## Segurança e integridade

A sessão autenticada resolve primeiro o participante comercial. Somente depois
disso o servidor consulta, com escopo explícito de empresa e participante, as
previsões próprias e os snapshots da franqueadora das mesmas vendas. Nenhuma
regra, percentual, previsão, pagamento ou dado de outro participante é escrito
ou recalculado pelo app.

## Validação

- Teste unitário do agrupamento de cinco parcelas, incluindo o cenário
  R$ 40.000,00 → R$ 33.000,00 → 12,5% → R$ 4.125,00.
- Teste da previsão de 30 dias por parcela.
- TypeScript, ESLint e build de produção executados.
