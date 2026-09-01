# Fase 213 — Identidade independente do site parceiro

## Objetivo

Garantir que um site de parceiro compartilhe somente o ERP e os dados operacionais
autorizados da empresa proprietaria, preservando dominio, modelo, identidade visual,
menus, conteudo e marca proprios.

## Causa corrigida

O dominio parceiro era resolvido corretamente para `parceiro_sites`, mas o layout
publico ainda sobrepunha cores e a classificacao visual da empresa proprietaria do
ERP. No caso de Racon Sinop, isso aplicava branding e recursos da Gauchinho sobre o
modelo configurado no parceiro.

## Implementacao

- o contexto publico reconhece explicitamente `partnerView` como site independente;
- cores do `empresa_branding` da proprietaria nao sobrescrevem mais o parceiro;
- nome, slug, logo e paleta do provider passam a vir do proprio site/modelo parceiro;
- recursos exclusivos da marca Gauchinho, como mascote e assistente, ficam desativados
  no dominio parceiro;
- o tenant Gauchinho continua sendo usado no servidor apenas como fronteira do ERP,
  permissao e propriedade dos dados.

## Preservacao

Nao houve migration, alteracao financeira ou regravacao de dados. Os dominios e os
modelos cadastrados permanecem independentes e a correcao atua somente na composicao
do contexto visual publico.

## Verificacao

- teste contratual da separacao de identidade;
- suite direcionada de parceiros;
- build de producao.
