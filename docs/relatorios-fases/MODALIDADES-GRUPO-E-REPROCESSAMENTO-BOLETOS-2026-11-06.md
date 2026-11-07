# Relatório — Modalidades por grupo e reprocessamento seletivo de boletos

Data: 06/11/2026

## Problemas identificados

- A interface classificava toda modalidade desconhecida como lance fixo. Com isso,
  grupos com lance fidelidade podiam aparecer como se tivessem lance fixo.
- A permissão de lance fidelidade estava fixa como habilitada.
- O robô aceitava reexecução, mas voltava a navegar em cotas que já possuíam PDF
  armazenado na competência atual.
- O ERP não oferecia uma ação para enfileirar a busca de uma única cota.

## Correções

- Modalidades são classificadas por `LIVRE`, `FIXO`, `SEGUNDO_FIXO` e `FIDELIDADE`.
- Checkboxes e validação server-side respeitam as modalidades ativas do grupo.
- Cada cota exibe “Lance automático: Ativo/Inativo”.
- O Controle de Boletos ganhou “Buscar boleto”, que enfileira apenas a cota escolhida.
- Reexecuções ignoram cotas com PDF já armazenado em `vendas_boletos_envios` ou
  `cotas_boletos`; cotas sem arquivo continuam elegíveis.

## Validação

- Testes específicos de boletos/controle: 16 aprovados.
- `npx tsc --noEmit`: aprovado.
- `npm run build`: aprovado, 173 páginas geradas.

Ainda não publicado nesta alteração.
