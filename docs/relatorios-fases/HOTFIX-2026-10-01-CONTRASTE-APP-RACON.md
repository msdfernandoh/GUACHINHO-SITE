# Hotfix — contraste dos cartões do app Racon

**Data:** 01/10/2026  
**Escopo:** app de indicadores da família Racon

## Problema

O tema Racon convertia os cartões âmbar do app para o azul institucional, mas
mantinha textos secundários e alguns ícones em cinza ou azul. O contraste era
insuficiente e dificultava a leitura, especialmente nas áreas de instalação do
app e compartilhamento do link de indicação.

## Correção

- textos `text-zinc-*` dentro de superfícies azuis passaram a ser brancos;
- ícones e textos `text-amber*` dentro dessas superfícies também passaram a ser
  brancos;
- o mesmo tratamento foi aplicado aos cartões com gradiente azul;
- `input` e `textarea` foram excluídos da regra para preservar texto azul-escuro
  sobre fundo branco.

A alteração está no tema compartilhado do app Racon e não modifica dados,
permissões, comissões ou isolamento por `empresa_id`.

## Validação

- teste de contrato do contraste do tema Racon;
- lint sem erros;
- build de produção do Next.js.
