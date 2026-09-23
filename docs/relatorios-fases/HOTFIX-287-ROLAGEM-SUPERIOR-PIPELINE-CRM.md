# Hotfix 287 — Rolagem superior no Pipeline CRM

## Objetivo

Facilitar a navegação horizontal entre as etapas do Pipeline Comercial sem
exigir que o usuário percorra a lista vertical de cards até o rodapé do quadro.

## Implementação

- Incluída uma barra de rolagem horizontal acima das colunas do Kanban.
- A barra é exibida apenas quando existem mais colunas do que a área visível.
- A rolagem superior e a rolagem do quadro permanecem sincronizadas nos dois
  sentidos.
- A largura é recalculada em mudanças de tamanho, filtros e modo de foco.
- O trilho e o cursor receberam contraste explícito para o tema escuro do CRM.

## Segurança e dados

Não houve alteração de dados, permissões, regras de acesso ou consultas ao
Supabase. A mudança é exclusivamente de navegação visual no cliente.

## Validação

- `npm run test:regression -- --run src/components/admin/crm/crm-kanban-board.test.ts`
- `npx tsc --noEmit`
- `npx eslint src/components/admin/crm/crm-kanban-board.tsx src/components/admin/crm/crm-kanban-board.test.ts`
