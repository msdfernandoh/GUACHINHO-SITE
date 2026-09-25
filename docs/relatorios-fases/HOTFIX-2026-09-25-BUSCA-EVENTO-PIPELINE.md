# Hotfix — Busca de evento no Pipeline Funil (25/09/2026)

## Pedido

No Pipeline Funil, a busca textual deve encontrar leads pelo nome do evento,
além do nome do cliente e demais dados de contato.

## Alteração

- O filtro imediato dos cards inclui `evento_nome`.
- A consulta de leads por `q` também inclui `evento_nome` quando a coluna está
  disponível; a seleção mínima para bases antigas conserva seu fallback.
- O campo de busca informa que aceita nome de evento e mostra o termo inicial
  quando o funil é aberto com `q` na URL.

## Escopo dos dados

Nenhuma migration ou alteração dos leads existentes. O filtro de acesso aos
leads é aplicado antes da visualização do funil.
