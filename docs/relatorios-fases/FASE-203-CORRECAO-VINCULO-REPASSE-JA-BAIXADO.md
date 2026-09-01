# Fase 203 — Correção de vínculo de repasse já baixado

## Problema

Ao selecionar outra previsão em um vínculo já baixado, a action recusava a alteração para preservar o livro financeiro. Como a mensagem aparecia longe da linha, a interface parecia salvar e retornava ao vínculo anterior.

## Solução

- Nova RPC tenant-aware e transacional `rpc_corrigir_vinculo_item_repasse`.
- A classificação do mesmo recebimento é transferida da previsão anterior para a nova, sem alterar o valor recebido nem o caixa.
- Liquidação da franquia e elegibilidade do participante são recalculadas para as duas previsões.
- A trilha `erp_repasse_vinculo_correcoes` registra vínculo anterior, novo, valor transferido, usuário e chave idempotente.
- Comissão já paga exige estorno antes da correção.
- O retorno de sucesso ou erro passa a ficar destacado na própria área de conferência.

## Preservação

Nenhum recebimento, pagamento, cliente ou comissão é excluído. A correção altera somente a classificação equivocada e cria uma evidência append-only da operação.
