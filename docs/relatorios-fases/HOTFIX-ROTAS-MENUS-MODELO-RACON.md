# Hotfix — Rotas e âncoras dos menus do modelo Racon

## Diagnóstico

O catálogo do modelo `racon_inspired` possuía os IDs corretos, mas os destinos
de Imóveis, Veículos e Pesados usavam slugs que não existem no roteador público.
O header ainda ocultava Início no desktop, e Sobre/Contato não possuíam âncoras
correspondentes no template.

## Correção

- Imóveis aponta para `/consorcio/imovel-parcela-reduzida`;
- Veículos aponta para `/consorcio/carro-sem-entrada`;
- Pesados aponta para `/consorcio/caminhao-para-autonomo`;
- os CTAs dos cards e links auxiliares usam as mesmas rotas válidas;
- Início aparece também no desktop;
- as seções institucionais expõem as âncoras `sobre` e `contato`;
- a migration 161 reconcilia o modelo publicado sem alterar os menus escolhidos
  por cada empresa.

## Preservação e validação

Não há alteração de tenant, vínculo, proposta, lead ou grupo. O hotfix modifica
somente metadados do modelo compartilhado. O contrato
`rotas-modelo-racon-161-contract.test.ts` impede a reintrodução dos três slugs
inválidos e confirma as âncoras de navegação.
