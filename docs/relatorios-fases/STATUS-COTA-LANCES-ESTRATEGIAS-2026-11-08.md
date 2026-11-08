# Relatório — Status de cota em Lances e Estratégias

Data: 08/11/2026  
Fase: Operação de lances e estratégias

## Entrega

- Adicionadas ações para marcar a cota como `Contemplada` ou `Cancelada`.
- A ação é validada contra a empresa ativa e atualiza o status canônico da cota.
- A estratégia de lance vinculada é desativada automaticamente.
- A alteração é registrada no histórico operacional da estratégia.
- A cota permanece listada com tag visual e pode ser localizada pelo filtro de status.
- Cotas contempladas e canceladas deixam de compor as contagens de sem estratégia,
  lance ativo, vencendo e vencidas.

## Validação

- `npm exec tsc -- --noEmit` — aprovado.
- O fluxo não utiliza a rotina financeira de estorno de cancelamento; a ação é
  exclusivamente operacional para impedir novas ofertas de lance e preservar a
  auditoria da cota.
