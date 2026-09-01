# Fase 200 — Transferência bancária de comissões e crédito fiscal no Caixa

Data: 01/09/2026

## Correção financeira

Pagamentos de comissão realizados pelo fluxo anterior podiam baixar a previsão e
alimentar o extrato interno do sócio sem gerar movimento na conta bancária. O pagamento
confirmado do Fernando na competência 2026-07, de R$ 6.187,50, encontrava-se nesse
estado: sem saída na conta Gauchinho Empresa e sem entrada na conta Fernando.

A migration 194 acrescenta vínculo tenant-aware entre conta bancária e participante,
evolui o pagamento bancário para registrar dois movimentos vinculados ao mesmo
`pagamento_id` e executa backfill restrito aos pagamentos confirmados que não possuem
nenhum movimento:

- saída da conta de origem da empresa;
- entrada na conta interna vinculada ao beneficiário;
- chaves de idempotência independentes e únicas por pagamento;
- nenhuma edição ou remoção de fatos financeiros existentes.

Novos pagamentos realizados no painel de Comissões exigem a escolha da conta de saída.
A conta vinculada ao próprio beneficiário não é oferecida como origem.

## Crédito fiscal mensal

O painel **Financeiro & Caixa** apresenta o valor de imposto já descontado das comissões
na competência corrente. A fonte é `comissao_previsoes_franquia.valor_imposto`, que
preserva o snapshot fiscal canônico. O indicador representa crédito reservado para o
pagamento dos impostos; ele não cria entrada bancária nem aumenta o saldo disponível.

## Segurança e preservação

Todas as relações são validadas por `empresa_id`. Contas de outra empresa não podem ser
vinculadas ao participante. O backfill exige origem determinística: exatamente uma conta
empresarial ativa, sem beneficiário, com saldo suficiente. Casos ambíguos permanecem sem
alteração para tratamento assistido.
