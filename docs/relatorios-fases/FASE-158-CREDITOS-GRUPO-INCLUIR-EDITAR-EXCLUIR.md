# Fase 158 — Créditos do grupo: incluir, editar e excluir

## Objetivo

Completar o cadastro de grupos com a gestão visual dos créditos comerciais
armazenados em `grupos_cotas`.

## Implementação

- O formulário compartilhado por ERP e Platform possui botão `Adicionar
  crédito`, lista os valores preparados e permite removê-los antes de salvar.
- Novos créditos de grupo local ficam disponíveis imediatamente no ERP e também
  seguem na solicitação de homologação global.
- A tabela inferior do ERP oferece edição e exclusão para grupos locais do
  próprio tenant. Catálogo global permanece editável somente pela Platform.
- A tela operacional da Platform também permite editar o valor de cada crédito,
  além da inclusão em lote e da exclusão já existentes.
- A migration 156 fornece RPCs canônicos com autorização tenant/Platform.

## Preservação histórica

Crédito ainda não utilizado pode ser atualizado ou excluído. Quando já existe
em venda ou simulação persistida, editar cria uma nova opção e inativa a
anterior; excluir apenas inativa. Assim, fatos e referências existentes não são
reescritos.
