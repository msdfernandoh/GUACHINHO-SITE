# Hotfix 283 — PDF separado para qualquer composição multigrupo

## Problema

A escolha de agrupamento era exibida somente quando dois grupos pertenciam ao
mesmo tipo comercial. Uma proposta com um grupo de Imóvel e outro de Veículo
não recebia a escolha, embora cada grupo tenha prazo, reajuste e condições
financeiras próprias.

## Correção

- A escolha é exibida para toda proposta com dois ou mais grupos.
- O modo inicial passa a ser **Separar por grupo**.
- O modo separado mantém capa única e adiciona uma folha para cada grupo,
  independente de tipo.
- A versão resumida é desabilitada enquanto a separação estiver selecionada,
  pois seu formato de uma folha não comporta o detalhamento individual.

## Evidência analisada

O PDF entregue nesta solicitação possui cinco páginas e já detalha em folhas
separadas os grupos de veículo 1071, 5388 e 5618. Ele não contém grupo de
Imóvel; a mudança garante a mesma separação para a combinação Imóvel + Veículo
na próxima emissão.
