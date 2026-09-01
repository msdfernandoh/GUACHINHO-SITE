# Fase 195 — Reconciliação do montante na formalização multicotas

## Problema confirmado

A contratação podia preservar um montante total antigo que não correspondia
mais ao produto canônico confirmado no ERP multiplicado pela quantidade de
cotas. No caso analisado, o registro trazia R$ 381.924,00, enquanto o produto de
R$ 131.127,24 e a quantidade de 3 cotas totalizam R$ 393.381,72. A RPC bloqueava
a operação em vez de corrigir o montante e materializar as três cotas.

## Correção

A migration 191 mantém as validações de tenant, grupo, produto, disponibilidade
e quantidade. Depois dessas validações, o montante operacional passa a ser
reconciliado por `valor_credito da cota × quantidade_cotas`. A venda recebe o
total reconciliado e cada cota definitiva conserva o valor unitário canônico.

Quando existe diferença, a mesma transação acrescenta ao histórico o evento
`DADOS_COMERCIAIS_AJUSTADOS`, com valor anterior, valor unitário, quantidade,
valor corrigido e motivo. A contratação também passa a guardar o total usado na
formalização. Se qualquer etapa falhar, ajuste, venda, cotas e histórico sofrem
rollback em conjunto.

A memória de cálculo exibe imediatamente o total canônico e informa o valor
anterior corrigido. Como o núcleo cria inicialmente a previsão para uma cota, a
RPC reconstrói as previsões sobre o total da venda antes de inserir as demais;
o mecanismo multicotas então distribui esse total entre as três cotas, sem
reduzir a base da comissão a apenas uma unidade.

## Preservações

- Nenhum dado de outro tenant é consultado ou alterado.
- Grupo, produto/cota e quantidade não são substituídos.
- O ledger de idempotência continua append-only.
- A migration 190 já existente não foi sobrescrita; esta evolução usa o número
  191.

## Verificação

O teste de contrato `formalizacao-multicotas-191-contract.test.ts` cobre o novo
cálculo, a auditoria, a persistência do montante e as garantias transacionais.
