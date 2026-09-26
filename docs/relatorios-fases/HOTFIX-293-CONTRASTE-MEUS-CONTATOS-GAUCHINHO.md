# Hotfix 293 — Contraste de Meus contatos na Gauchinho

## Problema corrigido

No painel escuro da Gauchinho, a tabela branca de **Meus contatos** herdava a
cor clara do contêiner administrativo. Nomes, telefones e demais campos
importados por VCF ficavam praticamente invisíveis sobre o fundo branco.

## Implementação

- Tabela, cabeçalho, linhas, ícones e campos passaram a ter cores explícitas
  da paleta `slate` sobre a superfície clara.
- As ações Editar e Enviar para lead receberam tons acessíveis e estados de
  foco/hover.
- A mensagem de importação também usa superfície clara e contraste próprio.
- A largura mínima da tabela preserva os cinco campos em telas menores com
  rolagem horizontal do próprio quadro.

## Segurança e dados

Não houve alteração nos contatos importados, escopo da empresa, permissões ou
processo de envio para lead. A alteração é exclusivamente visual.

## Validação

- `npm run test:regression -- --run src/app/admin/contatos/actions.test.ts src/app/admin/contatos/ui.test.ts`
- `npx tsc --noEmit`
- `npx eslint src/app/admin/contatos/ui.tsx src/app/admin/contatos/ui.test.ts`
