# Hotfix — PDF de proposta no portal Racon Sinop

Data: 17/09/2026

## Incidente

Ao confirmar a geração de proposta PDF em `raconsinop.com.br/grupos`, a API
`/api/public/grupos/fluxo` tentava registrar o lead antes de montar a simulação
e a proposta. A operação falhava com `Could not find the 'telefone_normalizado'
column of 'leads' in the schema cache`.

## Causa e correção

O código publicado já usa `public.leads.telefone_normalizado` e a RPC
`public.rpc_upsert_lead_por_telefone`, definidas na migration
`222_qr_institucional_e_deduplicacao_leads.sql`. A conferência remota do histórico
de migrations mostrou que a `222` ainda não havia sido aplicada em produção.

A migration `222` foi aplicada isoladamente ao Supabase vinculado em 17/09/2026.
Ela adiciona a coluna, índice, normalização por trigger e RPC de upsert de leads;
inclui também os objetos de QR institucional previstos na mesma migration.
Nenhum lead foi excluído e nenhuma proposta foi criada artificialmente na
verificação. A migration `223`, independente deste incidente, permaneceu
pendente e intacta.

## Validação

- `supabase db push --linked --dry-run` listou inicialmente as migrations `222`
  e `223` como pendentes.
- A aplicação isolada da `222` terminou sem erro.
- Consulta PostgREST ao campo `leads.telefone_normalizado` retornou sem erro,
  confirmando a atualização do schema cache.
- A chamada de diagnóstico da RPC com telefone inválido retornou a validação
  esperada (`ok: false`), sem gravar dados.
- Não foi repetida uma proposta real em nome do cliente; a geração completa do
  PDF depende de uma nova tentativa no portal.
