# Hotfix 275 — Isolamento visual das landings de parceiros

## Diagnóstico

As rotas `/parceiros` e `/parceiros/*` eram tratadas como telas operacionais
pela camada visual multi-tenant. Essa camada usa seletores globais para
reformular cores de botões, links, títulos e textos, entrando em conflito com
os blocos azul/branco próprios do programa de parceiros.

## Correção

- As landings de parceiros não recebem mais a classe `tenant-operational`.
- A aparência operacional continua ativa nas demais telas que dependem dela.
- O CTA do Network recebeu um seletor semântico e cores explícitas para
  preservar o texto azul sobre o botão branco.
- O componente de CTA passa a envolver o rótulo em `span`, permitindo controlar
  cor e contraste sem depender de seletores genéricos.

## Dados

Não houve alteração de banco, rotas, regras comerciais ou autenticação.
