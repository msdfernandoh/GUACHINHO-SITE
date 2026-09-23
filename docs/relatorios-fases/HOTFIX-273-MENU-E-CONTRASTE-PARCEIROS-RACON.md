# Hotfix 273 — Menu e contraste do programa de parceiros Racon

## Objetivo

Dar acesso direto ao programa comercial pelo menu público do Racon Sinop e
corrigir textos com baixo contraste na landing `/parceiros`.

## Implementação

- O normalizador de navegação Racon remove o item público `Área do parceiro`.
- O CTA `Seja parceiro` é preservado ou criado com destino `/parceiros`, sem
  duplicidade no menu desktop ou mobile.
- O cartão branco do hero recebeu superfície e cores semânticas explícitas
  para título, texto, destaque e link, protegidas das variáveis de cor do fundo
  azul da página.
- Foi incluído teste de regressão para a substituição do menu antigo.

## Escopo e dados

Não houve migration nem alteração de dados. A rota autenticada da área do
parceiro permanece disponível por acesso direto; somente seu item no menu
institucional foi removido.
