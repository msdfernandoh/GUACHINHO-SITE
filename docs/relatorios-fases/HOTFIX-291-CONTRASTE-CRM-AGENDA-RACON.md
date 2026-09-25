# Hotfix 291 — Contraste do CRM e Agenda Racon

## Objetivo

Restaurar a legibilidade das interfaces administrativas do modelo Racon em
Pipeline/Funil e Agenda, sem modificar fluxos, permissões ou dados comerciais.

## Correção aplicada

- Os filtros rápidos cinza do Pipeline passam a usar superfície clara e texto
  escuro no tenant Racon.
- O banner de filtro ativo do Funil recebe gradiente claro e tipografia de alto
  contraste.
- Os dias livres, com compromisso, bloqueados e sem horário do calendário
  recebem pares de fundo e texto legíveis no Racon.
- Títulos que usavam `text-zinc-50` em superfícies claras passam a respeitar o
  contrato de contraste do painel administrativo Racon.

## Escopo e segurança

As regras são limitadas a `.tenant-admin-racon`; os demais modelos mantêm sua
aparência atual. Não houve alteração em consultas, ações do CRM, agenda,
disponibilidade ou banco de dados.
