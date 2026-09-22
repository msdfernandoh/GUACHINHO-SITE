# Fase 243 — Link público do indicador com cadastro conversacional

## Entrega

Cada registro em `programa_indicadores` recebe o token UUID interno `codigo_indicacao` e o código curto aleatório `codigo_indicacao_curto`. O painel `/app-indicador` monta e permite copiar o endereço público prático `/i/[codigo]` no domínio do tenant ativo.

A página pública utiliza o mesmo componente conversacional do app. Antes dos dados pessoais, apresenta o texto comercial definido e pergunta a estratégia desejada e o prazo para utilizar o crédito. As respostas são armazenadas em `leads.estrategia_credito` e `leads.prazo_utilizacao_credito`, além do histórico cronológico do lead. O endpoint público resolve o tenant pelo host, confere o código apenas dentro de `empresa_id` e cria/atualiza o lead e `programa_indicacoes` com o `indicador_id` correspondente.

## Proteções e preservação

- A migration 243 é somente aditiva; não altera nem remove indicadores, leads ou indicações existentes.
- O código compartilhável possui 10 caracteres aleatórios, possui unicidade composta com `empresa_id` e não carrega CPF, nome ou outro dado pessoal.
- O código recebido pelo navegador nunca determina o tenant: a consulta exige o tenant resolvido pelo host.
- O telefone segue a deduplicação canônica de leads. Se já houver indicação de outro indicador para o mesmo lead, o vínculo é recusado sem sobrescrever a atribuição original.
- A busca de fallback do upsert de lead foi limitada ao `empresa_id` recebido, evitando cruzamento de leads entre tenants.

## Arquivos principais

- `supabase/migrations/243_link_publico_indicador_chat.sql`
- `supabase/migrations/244_link_curto_e_qualificacao_indicacao.sql`
- `gauchinho-app/src/app/(public)/indicacao/[codigo]/page.tsx`
- `gauchinho-app/src/app/api/public/programa-indicacao/route.ts`
- `gauchinho-app/src/components/app-indicador/indicacao-chat.tsx`
- `gauchinho-app/src/components/app-indicador/indicador-link-card.tsx`

## Validação realizada

- `npm run lint:errors`
- `npx tsc --noEmit`
- Teste de contrato `link-indicacao-publico-243-contract.test.ts`

## Rollout

Aplicar primeiro a migration 243 no ambiente de destino e só então publicar a aplicação. Em rollback da interface, a coluna e os tokens podem permanecer: são dados aditivos e inertes sem a rota pública. Não apagar tokens ou indicações históricas.
