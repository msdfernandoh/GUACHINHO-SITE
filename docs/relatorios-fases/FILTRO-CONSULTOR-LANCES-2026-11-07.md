# Filtro por consultor em Lances e Estratégias — 07/11/2026

## Implementação

A tela `/erp/lances` passou a oferecer o filtro independente **Todos Consultores**.
O filtro usa o identificador do consultor, evitando ambiguidades quando houver
nomes iguais, e também lista cotas sem consultor como **Sem consultor**.

## Validação

- `npx tsc --noEmit`: aprovado.
- `npm run build`: aprovado com 173 páginas.
- A filtragem permanece aplicada sobre as cotas carregadas no escopo da empresa,
  preservando os demais filtros e a busca livre.
