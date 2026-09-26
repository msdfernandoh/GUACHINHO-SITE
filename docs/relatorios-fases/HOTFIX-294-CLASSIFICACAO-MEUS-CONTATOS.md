# Hotfix 294 — Classificação em Meus contatos

## Objetivo

Permitir organizar contatos importados por empresa, profissão e tags sem usar
caixas de diálogo genéricas e sem precisar abrir outro cadastro.

## Implementação

- Empresa e profissão são editáveis diretamente na célula da tabela.
- Tags ficam visíveis no contato e podem ser adicionadas pelo botão **+ Tag**.
- Tags podem ser removidas individualmente.
- Cada linha possui **Descartar**, com confirmação, para remover um contato da
  lista privada do usuário.
- Filtros combináveis por empresa, profissão e tag foram incluídos no topo da
  lista.
- As tags são normalizadas, únicas por contato, limitadas a 20 itens e indexadas
  por GIN para consultas futuras eficientes.
- Ao enviar o contato para lead, as tags são registradas junto às observações
  comerciais do lead.
- A consulta de contatos agora é paginada em blocos de 100 itens, exibindo o
  intervalo e o total real. Isso elimina o teto padrão de 1.000 linhas da API
  e permite navegar por toda a importação VCF.

## Segurança e dados

A migration somente adiciona a coluna `tags` à tabela já protegida
`contatos_usuario`. As atualizações continuam exigindo o usuário autenticado e
a empresa ativa pelo vínculo `empresa_usuarios`; o descarte usa o mesmo escopo.
RLS não foi alterada.

## Aplicação no Supabase

O script `293_contatos_usuario_tags_classificacao.sql` foi aplicado isoladamente
no banco remoto e a coluna `public.contatos_usuario.tags` foi confirmada como
`text[]`. Nenhuma migration pendente de outro escopo foi executada.

## Validação

- `npm run test:regression -- --run src/app/admin/contatos/actions.test.ts src/app/admin/contatos/ui.test.ts src/app/admin/contatos/classificacao.test.ts`
- `npx tsc --noEmit`
- `npx eslint src/app/admin/contatos/actions.ts src/app/admin/contatos/ui.tsx src/app/admin/contatos/actions.test.ts src/app/admin/contatos/ui.test.ts src/app/admin/contatos/classificacao.test.ts`
