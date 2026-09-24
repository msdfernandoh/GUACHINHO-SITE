# Hotfix 289 — Tema Racon na tabela pública de Grupos

## Objetivo

Corrigir as rotas públicas operacionais nos tenants da família Racon, em
especial `raconsorriso.com.br` e `raconsinop.com.br`, que ainda podiam renderizar
o fundo escuro legado da Gauchinho Consórcios.

## Correção aplicada

- As rotas operacionais, incluindo `/grupos` e `/simulador`, recebem a camada
  `tenant-operational site-appearance`.
- A camada usa os tokens do tenant (`--visual-bg`, `--visual-title`,
  `--visual-text`, `--visual-button` e `--visual-button-text`) já resolvidos
  pelo domínio e pelo modelo Racon.
- Fundo, tabela, controles, tags, botões, textos auxiliares e barra fixa de
  totais passam a seguir a mesma paleta clara configurável da identidade Racon.
- O comportamento, os cálculos, o catálogo e as permissões da tela não foram
  alterados.
- A home, as páginas do Programa de Parceiros e o telão de sorteio ao vivo
  mantêm seus layouts próprios; o telão continua escuro para legibilidade em
  projeção.

## Verificação

- Incluído teste contratual que impede excluir novamente `/grupos` da camada
  operacional Racon.
- Executar a suíte do contrato de aparência e a checagem de tipos antes da
  publicação.
