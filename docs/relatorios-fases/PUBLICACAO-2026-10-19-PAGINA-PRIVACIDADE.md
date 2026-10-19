# Publicação da página de privacidade

Data: 19/10/2026.

## Escopo

Solicitação explícita do titular: instalar o arquivo `pagep.tsx` e publicar
na Vercel para disponibilizar a URL de privacidade do aplicativo Meta.

O arquivo foi copiado integralmente para
`gauchinho-app/src/app/privacidade/page.tsx`. Este é o diretório App Router
efetivo do projeto; criar `app/` na raiz não corresponderia à aplicação existente.
Inclui metadata, onze seções, contatos e âncora `#exclusao`. O texto é o conteúdo
fornecido pelo titular, sem revisão jurídica nesta tarefa.

## Preservação e limites

Nenhuma migration ou operação no banco, Storage, usuários ou dados comerciais.
Nenhuma alteração de autenticação, autorização, regras financeiras ou isolamento
N:N. A página usa o layout raiz e o proxy de domínio existentes. Não foram
alteradas configurações nem permissões no aplicativo Meta.

## Validação e implantação

- Projeto Vercel confirmado: `guachinho-site`.
- ID: `prj_rcdKOewLz7V2FXEvmn3qHlyMiKMT`.
- Root Directory: `gauchinho-app`.
- SHA-256 da origem e do destino idênticos:
  `5F511A1CC5F2DBC60A1FF6E73C713C1EFD6A0B947FEE29E839496A11E9E935CA`.
- ESLint direcionado: sem erros ou avisos.
- `npx tsc --noEmit`: exit 0.
- `git diff --check`: aprovado.
- `vercel --prod --yes`: exit 0; build de produção e TypeScript aprovados,
  com a rota `/privacidade` presente no manifesto do build.
- Deployment: `dpl_8eaggP2wPDkErAN8cLYpm4pkdg7C`.
- URL do deployment:
  `https://guachinho-site-57zwe0huk-hugo-8097s-projects.vercel.app`.
- GET anônimo em `https://www.gauchinhoconsorcios.com.br/privacidade`,
  em 19/10/2026 às 08:04 (America/Cuiaba): HTTP 200, sem redirecionamento.
  Confirmados no HTML: título, razão social, CNPJ, WhatsApp Business,
  onze seções, âncora `id="exclusao"` e link de e-mail do contato.
- Conteúdo instalado idêntico ao arquivo recebido. A página já pode ser
  informada pelo titular no aplicativo Meta.

## Reversão

Reverter a adição da página e publicar novamente, ou promover o deployment
anterior na Vercel. Não há alteração de banco a reverter.
