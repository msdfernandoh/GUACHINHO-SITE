# Fase 208 — exclusão de venda vinculada reabre o repasse

## Diagnóstico

A exclusão master tentava apagar a previsão de comissão, mas a previsão já era
referenciada pelo rateio do recebimento, pela baixa canônica do repasse e pela
linha importada do PDF. As chaves `ON DELETE RESTRICT` bloquearam corretamente
a perda desse histórico, porém não havia um fluxo de correção administrativa.

No caso auditado, a linha 3 do relatório estava ligada a uma previsão liquidada
de R$ 954,00. Havia baixa financeira do mesmo valor e a comissão do participante
estava elegível, ainda sem pagamento.

## Solução

- A exclusão master agora recusa previsões com comissão de participante paga.
- Para vínculos de repasse, registra lançamentos negativos compensatórios nos
  dois livros append-only.
- Remove o vínculo operacional da linha e a devolve para `NAO_ENCONTRADO`.
- Marca o relatório como pendente para permitir um novo vínculo.
- Venda, cota e previsões incorretas são canceladas e preservadas como tombstone
  auditável quando existe histórico financeiro.
- Cadastros sem qualquer histórico continuam podendo ser apagados fisicamente.
- A tela informa com precisão o tratamento aplicado e o cache do repasse é
  invalidado após a operação.

## Segurança

O tenant e a permissão master permanecem obrigatórios. Nenhum lançamento
financeiro existente é alterado ou apagado; a correção usa somente compensação.
