# Cancelamento das transferências não realizadas — 20/10/2026

## Autorização
O titular determinou cancelar o recebimento de transferência por Eroni de
R$ 8.856,98 e por Fernando de R$ 5.391,75, declarando que nenhuma foi realizada.

## Diagnóstico
Empresa: 7170f38e-15dd-4b19-8588-51e9a9cf0d4c (Gauchinho).
Os valores não eram registros de financeiro_transferencias_contas ou
financeiro_transferencias_socios. Eram movimentos bancários de pagamentos
agrupados de comissões de 28/09/2026:
- Fernando: pagamento daae5a46-c24c-4505-a3fc-17019828eba1, R$ 5.391,75.
- Eroni: pagamento d22abcae-d958-40ed-9300-0025bbf3d2fa, R$ 8.856,98.
Cada pagamento possuía saída na conta Gauchinho Empresa e entrada na conta
vinculada ao participante. Não havia estorno de pagamento nem corte lacrado.

## Correção executada no Supabase
Para preservar as comissões como crédito societário, não foi estornada a baixa
contábil da comissão. Anulada exclusivamente a movimentação bancária indevida,
por quatro movimentos de categoria ESTORNO, data 20/10/2026, vinculados aos
mesmos pagamentos e contas, com sinal oposto ao original. Foram inseridos em
uma única operação INSERT em lote (atômica), com chaves únicas determinísticas,
referência a cada movimento original e autorização do titular.

Não houve DELETE/UPDATE de movimentos, criação de nova transferência real,
novo recebimento ou alteração de parcelas de comissão. Compensações registradas:
- 9941ace9-5f2d-4347-8041-ddf05c3cca89: saída R$ 8.856,98 da conta de Eroni.
- 7e41d136-8e98-409e-9e4c-f4409a8ad9b6: entrada R$ 8.856,98 na conta empresarial.
- 98c6c2f9-cf57-4f01-93fe-509ba8ba4fae: saída R$ 5.391,75 da conta de Fernando.
- 78864ff6-f746-4295-9c14-d542b3bd336d: entrada R$ 5.391,75 na conta empresarial.

## Verificação posterior
- Transferência líquida dos pagamentos por conta: zero centavos para ambos.
- Movimentos originais preservados integralmente (comparação por id/conteúdo).
- 21 itens de financeiro_pagamento_itens preservados; hash SHA-256 antes/depois
  idêntico. Cabeçalhos das comissões continuam confirmados, sem perda de crédito.
- Conta Gauchinho Particular (Eroni): R$ 8.856,98 → R$ 0,00.
- Conta Fernando: R$ 5.391,75 → R$ 0,00.
- Conta Gauchinho Empresa: R$ 83.577,79 → R$ 97.826,52.
- Recomposição total da posição empresarial: R$ 14.248,73.

O saldo acima é contábil do sistema, não confirmação de saldo de extrato real.
As pendências de despesas pagas sem saída vinculada continuam exigindo conciliação.
A operação não alterou schema, código, imposto ou recebimento da administradora.
O fechamento deriva a retirada líquida dos movimentos vinculados ao pagamento;
as comissões permanecem no crédito até efetiva transferência futura.
