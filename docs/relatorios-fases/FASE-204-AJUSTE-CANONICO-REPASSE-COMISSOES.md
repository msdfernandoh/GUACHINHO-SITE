# Fase 204 — Ajuste canônico entre repasse e comissões

## Diagnóstico

As telas exibiam cálculos proporcionalmente corretos, porém baseados na previsão original mesmo após a decisão `Ajustar no sistema`. Exemplo: empresa R$ 1.590,00, relatório R$ 1.060,00 e saldo R$ 530,00; participante líquido R$ 1.311,75 e elegível proporcional R$ 874,50.

## Correção

A migration 201 torna o valor do relatório a previsão efetiva quando o usuário escolhe `AJUSTAR_DIFERENCA`. Atualiza na mesma transação previsão da empresa, base e líquido do participante, elegibilidade, status e metadados fiscais. O snapshot registra valores anterior e novo e a resolução que autorizou a mudança. Ajustes já registrados recebem o mesmo tratamento por backfill idempotente.

## Segurança

Recebimentos e caixa permanecem append-only. Pagamentos maiores que o novo valor bloqueiam o ajuste até estorno explícito.
