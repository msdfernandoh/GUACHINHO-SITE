# Fase 279 — Proposta de grupos separada por folha

Data: 23/09/2026

## Problema

Mais de um grupo de veículo podia ser apresentado em um mesmo bloco de proposta, apesar de cada grupo possuir início, prazo e condições próprias. Isso induzia a leitura de prazo e parcela como se fossem uma única solução homogênea.

## Entrega

- O modal de geração de proposta exibe a decisão **Unificar** ou **Separar por grupo** quando há dois ou mais grupos do mesmo tipo de bem.
- A decisão é salva em `dados_simulacao.modo_agrupamento_grupos` para que novas emissões e downloads mantenham o formato escolhido.
- No modo separado, a capa e o resumo consolidado continuam únicos; cada página de detalhamento contém exatamente um grupo.
- Cotas do mesmo grupo permanecem agregadas no seu próprio detalhamento. Grupos distintos nunca têm prazos, início, taxa, lance ou condições somados na mesma folha.

## Validação

- Teste de renderização adiciona dois grupos de veículo com prazos distintos no modo separado.
- TypeScript e testes do documento PDF são executados antes da publicação.
