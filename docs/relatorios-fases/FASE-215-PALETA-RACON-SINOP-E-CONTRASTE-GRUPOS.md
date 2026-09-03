# Fase 215 — Paleta Racon Sinop e contraste na página de Grupos

## Objetivo

Padronizar o portal público Racon Sinop com a identidade azul do portal Racon
Sorriso e assegurar contraste legível na tabela de Grupos.

## Implementação

- O portal parceiro `racon-sinop` passa a usar identidade visual própria Racon:
  azul primário `#0066cc`, azul escuro `#0c2340` e destaque `#0099dd`.
- O cabeçalho da tabela de Grupos utiliza a cor primária do portal e títulos em
  branco, centralizados em suas respectivas colunas, inclusive na coluna fixa de
  Ajustes.
- A tag `Em Formação` usa azul escuro e texto branco em desktop e mobile.
- A regra específica da tag prevalece sobre a normalização de texto escuro dos
  componentes operacionais do modelo Racon.

## Preservação

A migration é restrita ao UUID e slug do portal Racon Sinop. Não altera grupos,
créditos, simulações, propostas, dados comerciais, ERP, permissões ou domínios.

## Verificação

- teste de tipos/lint direcionado dos componentes públicos;
- inspeção estática da migration restrita ao parceiro Racon Sinop.
