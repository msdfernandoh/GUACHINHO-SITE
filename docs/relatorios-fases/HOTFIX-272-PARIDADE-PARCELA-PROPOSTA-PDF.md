# Hotfix 272 — Paridade da parcela entre simulador e proposta PDF

## Objetivo

Garantir que os valores financeiros de uma proposta PDF sejam idênticos aos
valores mostrados na tela de grupos da empresa que a emite.

## Diagnóstico

O catálogo público aplica ajustes locais de `empresa_grupos_config` enquanto
o endpoint de proposta e a reemissão do PDF liam apenas o grupo global. Em
grupos com alteração local pendente, o saldo devedor podia ser calculado sem o
fundo de reserva ou com taxa administrativa anterior, afetando primeira
parcela, lance, crédito líquido e parcela pós-contemplação.

## Implementação

- A validação das seleções do fluxo público resolve o grupo efetivo da empresa
  antes do cálculo e impede o uso de grupo oculto localmente.
- O carregamento de dados do PDF resolve a mesma configuração local antes de
  recalcular a estratégia gravada.
- Adicionado teste de regressão para taxa e fundo de reserva provenientes de
  ajuste local pendente.

## Dados e tenancy

Não houve migration nem alteração destrutiva. As propostas existentes são
recalculadas com o catálogo efetivo da sua própria `empresa_id` quando o PDF é
emitido novamente. A configuração continua tenant-scoped por
`empresa_grupos_config`.
