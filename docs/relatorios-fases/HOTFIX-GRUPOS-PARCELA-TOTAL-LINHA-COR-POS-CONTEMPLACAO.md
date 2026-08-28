# Hotfix — parcela total na linha e cor pós-contemplação

## Problema

Na tabela pública de grupos, a coluna “Parcela” mostrava o valor unitário mesmo
quando a quantidade selecionada era maior que uma cota. O rodapé já mostrava o
total correto, criando divergência visual dentro da mesma tela. A parcela
pós-contemplação também usava destaque verde, diferente do padrão amarelo dos
valores comerciais principais.

## Correção

- a coluna “Parcela” passa a usar `primeiraParcela`, que já representa parcela
  unitária multiplicada por `quantidadeCotas` e considera a opção de seguro;
- o rodapé continua usando o mesmo total, eliminando a divergência;
- a parcela pós-contemplação passa ao destaque amarelo nos contextos desktop,
  mobile, ajustes da linha e resumo expandido.

Não houve alteração de fórmula, snapshot, banco ou migration.

## Validação

- regressão com duas cotas confirma `primeiraParcela = parcelaBase × 2`;
- suíte direcionada, ESLint e build de produção executados após a alteração.
