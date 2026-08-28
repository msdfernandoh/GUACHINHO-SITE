# Fase 157 — Seguro prestamista global dos grupos

## Objetivo

Remover do cadastro de grupo a decisao de habilitar o seguro prestamista. Todo
grupo possui seguro; antes da contemplacao a adesao e escolhida no fluxo da
venda e, depois da contemplacao, torna-se obrigatoria.

## Implementacao

- ERP e Platform exibem somente a taxa decimal do seguro no formulario
  compartilhado, sem checkbox de habilitacao.
- O cadastro administrativo legado tambem deixa de exibir os controles de
  habilitacao e pos-contemplacao.
- Actions do ERP e do cadastro legado persistem os marcadores de compatibilidade
  como verdadeiros.
- A migration 155 normaliza grupos existentes e altera os defaults das colunas
  legadas para `true`, sem remover colunas nem snapshots historicos.
- A escolha do cliente continua pertencendo a simulacao/venda; a taxa do grupo
  permanece a fonte do calculo quando o seguro for aplicado.

## Preservacao

Nenhum grupo, proposta, contratacao ou snapshot foi excluido. As colunas
booleanas foram mantidas para compatibilidade com os consumidores existentes.
