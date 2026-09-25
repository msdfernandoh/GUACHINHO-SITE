# Hotfix 292 — Importação resiliente de contatos iCloud

## Problema corrigido

Arquivos VCF do iCloud podem conter o mesmo telefone em mais de um cartão. A
importação enviava esses registros repetidos no mesmo `upsert`, causando o erro
Postgres `ON CONFLICT DO UPDATE command cannot affect row a second time` e
impedindo que qualquer contato do arquivo fosse exibido.

## Implementação

- Telefones são normalizados e consolidados no servidor antes de gravar.
- Quando há repetição, é preservado o cartão com mais informações preenchidas.
- A gravação é feita em lotes de 500 contatos para suportar exportações grandes.
- A interface informa quantos contatos repetidos foram consolidados.

## Segurança e dados

O escopo de empresa e usuário continua resolvido pelo servidor a partir da
sessão autenticada. A unicidade por empresa, usuário e telefone normalizado é
preservada, sem alterar nem expor contatos de outros usuários.

## Validação

- Inspeção do VCF informado: 6.462 telefones, 107 números repetidos.
- `npm run test:regression -- --run src/app/admin/contatos/actions.test.ts`
- `npx tsc --noEmit`
- `npx eslint src/app/admin/contatos/actions.ts src/app/admin/contatos/ui.tsx src/app/admin/contatos/actions.test.ts`
