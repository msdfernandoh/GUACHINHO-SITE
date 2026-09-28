# Painel de fechamento: despesas, consultores e metas — 28/09/2026

## Entrega

O painel `/erp/fechamento-socios` ganhou o quadro “Olhar mês a mês”, com duas abas simples:

1. **Despesas por categoria:** lista cada mês com contas efetivamente pagas, o valor por centro de custo, o teto, a diferença em relação ao mês anterior e alertas para gasto acima do teto ou aumento mensal. Guias fiscais, contas abertas e lançamentos futuros não entram no quadro.
2. **Consultores e vendas:** mostra por mês consultores ativos e novos, vendas não canceladas, crédito vendido e repasses Racon efetivamente recebidos. O texto separa repasse de lucro livre, pois parte do recurso ainda pertence a impostos e comissões.

As metas mensais da empresa podem ser definidas no próprio painel para consultores ativos, quantidade de vendas e crédito vendido. Foram guardadas na estrutura multiempresa já existente `metas_comerciais`, com `empresa_id`, período e alvo `empresa`.

## Dados e critérios

- A data de entrada do consultor é preferida; a data de criação é usada em cadastros históricos sem essa data.
- Vendas canceladas não contam para a meta comercial.
- “Repasses recebidos” é o valor liquidado dos itens dos recebimentos confirmados, por mês de recebimento.
- A comparação de despesas usa o mês do pagamento (`pago_em`) e o teto configurado do centro de custo no momento da consulta.

## Banco e segurança

A migration `300_meta_consultores_cadastrados.sql` permite o indicador `consultores_cadastrados` na tabela já protegida por RLS `metas_comerciais` e cria índice de consulta por empresa, indicador e período. A gravação é feita por action com validação da empresa ativa e permissão `gerenciar_financeiro`.

## Validação

- Migration 300 executada no Supabase ligado e registrada no histórico.
- `npx tsc --noEmit` concluído sem erros.
- Build de produção executado localmente após a alteração.
