# Fase 275 — Reuso de lead ativo na proposta pública de grupos

Data: 23/09/2026
Escopo: `gauchinho-app` e Supabase do projeto vinculado, sem acesso ao projeto legado.

## Problema confirmado

Ao gerar uma proposta no fluxo público de grupos, o telefone era normalizado corretamente, mas a RPC canônica de consolidação consultava apenas `leads.empresa_id = empresa_id` resolvido pelo host. Leads criados antes da tenantização, com `empresa_id IS NULL`, não eram localizados. Consequentemente, o fluxo criava um segundo lead e associava a nova proposta a ele.

## Correção aplicada

- Criada a RPC privada `rpc_adotar_lead_legado_e_upsert_por_telefone(jsonb)`.
- A RPC recebe o `empresa_id` exclusivamente do endpoint que o resolve pelo host; ela nunca aceita seleção de tenant no navegador.
- Para o mesmo telefone, ela só adota um lead legado quando todas as condições são verdadeiras:
  - o lead possui `empresa_id IS NULL`;
  - ele não está ganho/fechado, inclusive pela etapa do funil;
  - não há lead ativo daquele telefone já pertencente à empresa resolvida;
  - a solicitação não exige explicitamente uma nova negociação.
- A adoção é `NULL → empresa_id` e ocorre no mesmo bloqueio transacional por telefone. Não há consulta, atualização ou transferência de registros de outra empresa.
- Após a adoção, a RPC delega a atualização de dados, histórico, etapa e retorno do `lead_id` para `rpc_upsert_lead_por_telefone`, preservando a regra existente de reabrir o lead ativo e de criar nova negociação somente para venda ganha.
- O fallback TypeScript reproduz o recorte seguro: considera apenas o tenant atual ou legado sem empresa, prioriza o lead já tenantizado e adota o legado somente para o tenant atual.

## Impacto de dados e reversão

Não existe backfill e nenhum lead é removido. A única escrita de escopo possível é a adoção controlada de um lead legado acionada por um novo contato público. Para reverter o comportamento futuro, basta substituir o endpoint novamente pela RPC canônica; os leads já adotados mantêm associação consistente com as novas propostas e não devem ser desassociados sem auditoria dos vínculos criados.

## Validação

- `npm test -- --run src/lib/crm/upsert-lead.test.ts` — 11 testes aprovados.
- `npx tsc --noEmit` — aprovado.
- A migration 255 deve constar aplicada no histórico remoto antes da publicação do código.
