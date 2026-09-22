# Fase 260 — Navegação de parceiros e atalho do indicador

## Objetivo

Simplificar a navegação pública que antes exibia Imobiliárias e Seguradoras
como itens independentes, preservar ambos os destinos e reforçar o acesso ao
Programa de Parceiros.

## Entrega

- O menu público padrão agrupa `Imobiliárias` e `Seguradoras` em `Negócios`,
  com os dois links disponíveis no desktop e no menu mobile.
- `Seja parceiro` foi incluído como item próprio de navegação e direciona para
  `/parceiros`.
- O chrome Racon usa o mesmo agrupamento e preserva o CTA `Seja parceiro`.
- O painel do Indicador recebeu somente o atalho `Conheça os nossos programas`,
  apontando para `/parceiros`; a estrutura visual, ações, métricas e dados do
  painel permanecem inalterados.

## Segurança e dados

Não houve migration, alteração de banco de dados, autenticação, permissões,
comissões ou escopo multiempresa. Os links relativos preservam a resolução do
tenant pelo host ativo.

## Verificação

- Teste unitário de normalização da navegação Racon atualizado para validar a
  preservação de Seguradoras e a criação de `Seja parceiro`.
- TypeScript e testes selecionados executados após a alteração.
