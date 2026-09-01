# Fase 203 — Repasse canônico, vínculo atômico e titular CNPJ

## Problema auditado

No relatório `RACON.pdf` de 2026-08, a linha 19 (grupo 005288, cota 1176)
foi trocada para a previsão correta, mas somente R$ 327,81 foram transferidos.
O valor da linha era R$ 655,64 e ficaram R$ 327,83 sem classificação. Como a
troca e o complemento eram duas RPCs, a primeira podia concluir sem a segunda.
A previsão e sua comissão participante permaneceram parcialmente liquidadas.

Também foi confirmado que a contratação é pessoa jurídica: a razão social é
`SNP VERTICAL BROKER LTDA` e `VANESSA LANDO` é a responsável. A venda havia
copiado `contratacoes_online.nome`, causando nomes diferentes entre telas.

## Solução

- `erp_repasse_item_baixas` registra, em livro append-only, a baixa exata de
  cada linha do PDF; o valor exibido deixa de ser inferido apenas pelo título.
- `rpc_corrigir_vinculo_item_repasse` passou a reverter o vínculo anterior,
  vincular o novo, completar a baixa e recalcular franquia e participantes na
  mesma transação.
- `sincronizar_item_repasse_canonico_203` adota o valor da linha do relatório
  para a previsão vinculada e propaga imposto, líquido e elegibilidade pelo FK
  `previsao_franquia_id`.
- `erp_repasse_item_conciliacao_canonica` expõe a conferência linha a linha por
  uma fonte única.
- O trigger `trg_normalizar_titular_venda_cnpj_203` garante que vendas ligadas
  a contratos CNPJ usem a razão social como titular; a pessoa física permanece
  preservada no snapshot como responsável contratual.
- O backfill corrige as vendas CNPJ existentes e repara as linhas 19, 20 e 21
  do relatório auditado, consumindo somente o saldo real não classificado.

## Integridade

As tabelas financeiras existentes continuam append-only. Trocas de vínculo
geram reversão e novo lançamento, sem editar o histórico. O ajuste bloqueia
redução abaixo de valores já pagos, respeita tenant e exige a permissão
`gerenciar_financeiro` nas RPCs públicas.

