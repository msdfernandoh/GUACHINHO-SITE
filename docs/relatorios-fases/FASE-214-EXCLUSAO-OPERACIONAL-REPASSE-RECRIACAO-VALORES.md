# Fase 214 — Exclusão operacional e recriação pelo repasse

## Problema

Vendas/cotas criadas a partir do PDF permaneciam visíveis nas comissões da
empresa e do participante depois da exclusão administrativa. A linha do PDF era
reaberta, mas o vínculo manual usava uma lista extensa e a recriação igualava a
comissão do vendedor ao valor integral recebido pela empresa.

## Correção

- previsões com estado `cancelada` deixam de compor as telas operacionais de
  Comissões da empresa e Minhas comissões;
- a linha do PDF continua sendo devolvida para `NAO_ENCONTRADO`, preservando o
  recebimento e registrando a reversão financeira append-only;
- antes de remover o vínculo, o banco preserva a venda anterior e o total de
  comissão do participante como referência auditável;
- linhas já reabertas pela Fase 208 recebem backfill a partir do livro de baixas;
- cada seletor de vínculo possui busca local por cliente, grupo, cota,
  competência ou parcela;
- a recriação apresenta separadamente o valor recebido pela empresa e a
  comissão correta do vendedor, validando que o segundo não ultrapasse o
  primeiro;
- a operação de recriação é transacional e grava os dois valores no snapshot da
  previsão do participante.

## Preservação

“Excluir” significa retirar completamente o cadastro incorreto da operação e
das telas comuns. Fatos que já participaram de um recebimento não são apagados
fisicamente: permanecem como tombstone cancelado e reversão compensatória para
manter auditoria, caixa e histórico do PDF íntegros.

## Verificação

- testes contratuais das Fases 182, 203, 208 e 214;
- validação do build de produção;
- dry-run e aplicação forward-only da migration 214 no Supabase principal.
