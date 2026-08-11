# Fechamento técnico da base SaaS — 064–066

Data: 11/08/2026  
Branch: `codex/fechamento-tecnico-saas`  
Produção atual: Supabase `001–066`. As migrations 064–066 foram aplicadas ao projeto principal por comando CLI que usa `supabase/.temp/project-ref`; isto ocorreu antes de fechar Preview e Performance/Lint. Não foi feito rollback, pois as migrations são forward-only e reversão de retenção/policies/auditoria acrescentaria risco.

## ENCONTRADO

- FKs históricas ainda usavam `ON DELETE CASCADE`, inclusive em venda, cota, previsões, financeiro, caixa, auditoria e gestão.
- `audit_logs_central` era append-only, mas não havia produtor runtime efetivo; o `log_audit_event` legado grava outra tabela.
- Risco material de Storage em Produção: `propostas-pdf` permitia leitura a qualquer autenticado; `contratacoes-documentos` permitia leitura por perfis legados, ambos sem vínculo ao tenant/objeto.
- O dashboard possui agregações em memória e N+1 de metas. As estatísticas e planos disponíveis não justificaram índice novo sem suposição.
- Lint refeito: baseline `52 erros / 77 avisos`.

## CORRIGIDO NA BRANCH

- Migration `064_retencao_historico_comercial_financeiro.sql`: fatos históricos passam a `RESTRICT`.
- Migration `065_storage_privado_tenant_aware.sql`: leitura e escrita direta dos dois buckets privados dependem do registro de proposta/contratação e das funções canônicas N:N; caminhos legados permanecem válidos.
- Migration `066_auditoria_runtime_transacional.sql`: triggers auditam venda, contratação, comissões, financeiro, caixa, gestão, tenant e concessão de administradora na própria transação. A falha de auditoria aborta a operação. O serviço central sanitiza senha, token, secret, cookie e authorization antes de gravar.
- Cinco erros mecânicos de lint (`const`) foram removidos sem alterar comportamento.

## NÃO ALTERADO

- Sorteios, `grupos_sorteios_loteria_public_read`, schema/policies/runtime/testes funcionais relacionados.
- Motor financeiro e comissões 060–063.
- Platform Host, tenant Gauchinho, template Racon, tenant Sorriso e sites comerciais.
- Buckets públicos legados: requerem decisão explícita de produto/contrato antes de se tornarem tenant-aware.
- FKs de entidades configuráveis cujo `RESTRICT`/`SET NULL`/inativação exige semântica de negócio.

## MIGRATIONS CRIADAS

- `064_retencao_historico_comercial_financeiro.sql`
- `065_storage_privado_tenant_aware.sql`
- `066_auditoria_runtime_transacional.sql`

## MIGRATION APLICADA

- Branch Supabase descartável `codex-fechamento-tecnico-064` (`ucxncmzotckeotqjhjvt`): `001–066` local=remote.
- Produção principal (`eaeuoynprurmmulzhydt`): `001–066` local=remote.

## TESTE ISOLADO

- `supabase/tests/retencao_historico_064.sql`: catálogo de 18 FKs em `RESTRICT` e tentativa de exclusão bloqueada; `ROLLBACK`.
- `supabase/tests/storage_tenant_065.sql`: anon bloqueado; visualizador A lê somente A; admin A escreve somente A; Tenant B bloqueado; `ROLLBACK`.
- `supabase/tests/auditoria_runtime_066.sql`: alteração de venda cria evento transacional e é revertida junto; `ROLLBACK`.
- `npm test`: `669 pass`, `37 skipped`.
- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS.
- `npm audit --omit=dev` via registry oficial: `0 vulnerabilities` (o registry configurado originalmente não implementa endpoint de audit).

## PERFORMANCE / LINT

- Não foi criado índice novo: não há plano representativo que comprove ganho, e criar índice por suposição foi evitado.
- Pendente: agregações SQL/RPC para dashboards e eliminação do N+1 de metas, pois demandam mudança de desenho de consulta e validação funcional.
- Lint após ajustes mecânicos: `45 erros / 77 avisos` (redução de 7 erros). Os restantes concentram-se em efeitos React e tipos de fluxos públicos/administrativos. Não foram suprimidos por configuração.

## PREVIEW / MERGED / DEPLOYED / HOMOLOGADO

- Preview Vercel: pendente.
- Merge: pendente.
- Deploy Production de runtime: pendente.
- Homologação final: pendente dos gates de lint, profiling/paginação e Preview. A aplicação das migrations no banco principal precedeu estes gates; não houve rollback para evitar risco adicional.

## DECISÃO DE NEGÓCIO NECESSÁRIA

- Política de retenção para programa, regra, participante, parceiro, grupo e administradora configuráveis: escolher formalmente entre `RESTRICT`, `SET NULL` e inativação.
- Contrato de visibilidade dos buckets públicos legados antes de qualquer migração de path/tenant.
