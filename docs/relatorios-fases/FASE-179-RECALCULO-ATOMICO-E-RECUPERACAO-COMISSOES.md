# Fase 179 — Recálculo atômico e recuperação de comissões

Data: 31/08/2026

## Problema observado

O extrato de `Minhas comissões` continuava mostrando quatro vendas confirmadas do
participante Fernando, totalizando R$ 1.712.000,00 em crédito, mas não exibia
nenhuma parcela de comissão. A investigação confirmou ausência simultânea das
previsões da franqueadora e do participante para essas vendas.

## Causa raiz

A ação master de edição de venda removia diretamente as previsões futuras com o
cliente administrativo e, somente depois, chamava
`rpc_gerar_previsoes_comissao_v2` também com o cliente administrativo. Desde a
migration 171, a RPC pública exige uma sessão `authenticated` com a permissão
`formalizar_vendas` e não aceita `service_role`. Como o erro retornado pela RPC
não era verificado, a remoção permanecia gravada e a tela passava a apresentar
zero parcelas.

## Correção aplicada

- removidas da action as exclusões prévias de previsões;
- chamada da RPC alterada para o cliente da sessão autenticada;
- falhas nas atualizações da venda, da cota e no recálculo agora interrompem a
  operação e são apresentadas ao chamador;
- a substituição das previsões fica inteiramente dentro da transação do motor de
  comissões, preservando o cronograma anterior se a geração falhar;
- a migration 176 recompõe somente as quatro vendas afetadas, com travas e
  validações de empresa, status confirmado, participante, perfil e cota ativa;
- a recuperação é cancelada integralmente diante de cronograma parcial ou de
  qualquer divergência dos vínculos canônicos.

## Dados preservados

A migration não altera vendas, cotas, clientes, regras, recebimentos nem
pagamentos. Ela apenas recria previsões ausentes. Se os dois cronogramas já
existirem, a venda é ignorada de forma idempotente.

## Verificações

- contrato automatizado da Fase 179;
- suíte de testes do módulo;
- lint e build de produção;
- verificação pós-migration da quantidade e dos totais das previsões por venda e
  participante.

