# Hotfix 281 — Escolha de agrupamento no PDF

## Correção

O modal **Gerar proposta PDF** só reconhecia grupos do mesmo tipo pela coluna
`modalidade`. Catálogos legados podem apresentar o tipo comercial em
`categorias_publicacao` ou no próprio `codigo_grupo`, como `5388 VEÍCULO`.
Nessa situação, a escolha de agrupamento não era exibida embora dois grupos de
veículo estivessem selecionados.

## Resultado

O reconhecimento agora combina modalidade, categorias publicadas e código do
grupo. Quando houver dois ou mais grupos equivalentes, o consultor vê as opções
**Unificar** e **Separar por grupo**. A opção continua disponível também com a
versão resumida marcada; a API já persiste a decisão em
`dados_simulacao.modo_agrupamento_grupos`.
