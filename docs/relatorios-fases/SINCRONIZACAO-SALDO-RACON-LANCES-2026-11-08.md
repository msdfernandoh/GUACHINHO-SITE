# Sincronização do saldo da Racon antes do lance — 2026-11-08

## Objetivo

Garantir que o ERP use os dados efetivamente exibidos pelo Newcon/Racon depois que a cota for localizada, sem calcular lance ou embutido sobre o crédito contratado.

## Correção aplicada

- O robô exige o saldo devedor apresentado na tela da Racon antes de enviar qualquer oferta.
- O saldo devedor e o valor do bem lidos na Racon são gravados no `snapshot_cota` da `cotas_definitivas`, com origem e horário da atualização.
- A tela de Lances e Estratégias passa a priorizar o saldo atualizado no `snapshot_cota`; o saldo do catálogo fica somente como fallback.
- O cálculo de percentual e valor do lance permanece baseado no saldo devedor individual.
- Se a tela não aceitar o percentual solicitado, o robô interrompe aquela oferta antes da confirmação para evitar enviar 25% no lugar de 50%.

## Verificação

- `node --check scripts/robo-lances-service.mjs`
- `npx vitest run src/lib/erp/robo-lances.test.ts`
- `npx tsc --noEmit`
