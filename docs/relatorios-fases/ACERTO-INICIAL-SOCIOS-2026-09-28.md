# Acerto inicial dos sócios — 28/09/2026

## Objetivo

Preparar o primeiro fechamento entre Fernando e Eroni sem misturar caixa da
empresa, comissão retida, impostos e dinheiro próprio dos sócios.

## Correções aplicadas no Supabase

- As 105 contas pagas que estavam atribuídas a Eroni, no total de
  R$ 73.555,05, foram reclassificadas como despesas pagas pela empresa. A
  origem econômica já era `CAIXA_LIVRE_EMPRESA`; a marca pessoal estava
  incorreta.
- As 20 contas pagas por Fernando permanecem como dinheiro próprio, no total
  confirmado de R$ 9.790,61.
- Os dois lançamentos históricos de R$ 9.300,00 foram marcados como estornados
  e mantidos no ledger com a justificativa. Eles não participam mais do
  cálculo nem duplicam o crédito de Fernando.
- O repasse Racon de R$ 17.961,66, de 17/09/2026, recebeu a entrada bancária
  auditável na conta Gauchinho Empresa. Os cinco repasses confirmados passam a
  ter total de R$ 54.970,35 no caixa corporativo.

## Regras consolidadas

1. Repasse Racon é receita da empresa. Impostos são reserva da empresa e
   comissões são obrigações separadas por beneficiário.
2. A margem obtida nas vendas de consultores e microfranqueados reduz as
   despesas a ratear entre Fernando e Eroni.
3. Receita de evento sem imposto usa a categoria `RECEITA_EVENTO` e também
   reduz a despesa a dividir.
4. Dinheiro próprio de sócio depositado na conta PJ é um aporte rastreável e
   cria crédito para o sócio; pagamento direto de fornecedor por Fernando
   permanece identificado como despesa paga por ele.
5. Comissão já mantida na conta da empresa só muda de classificação ao cobrir
   a obrigação do sócio. Ela não cria nova entrada bancária.

## Implementação

- Migration 298: correções históricas, repasse pendente e categoria de receita
  de evento.
- Migration 299: RPC de aporte pessoal de sócio, executada exclusivamente pela
  action autenticada do servidor.
- `/erp/fechamento-socios`: calcula automaticamente a margem de consultores e
  receitas de eventos; mostra repasses, comissão de consultores, comissões dos
  sócios e dinheiro próprio em blocos separados.
- `/erp/financeiro`: passa a oferecer `Receita de evento sem imposto`.

## Validação

- Migrations 298 e 299 executadas no Supabase remoto e registradas no histórico.
- Consulta posterior confirmou que somente Fernando permanece como pagador
  pessoal de despesas, por R$ 9.790,61.
- `npx tsc --noEmit` executado com sucesso após a alteração da aplicação.

## Limite para o primeiro fechamento

O fechamento continua exigindo conferência do saldo real no extrato da conta
Gauchinho Empresa. O painel não permite lacrar se a conciliação de repasses,
reserva fiscal ou saldo bancário divergir.
