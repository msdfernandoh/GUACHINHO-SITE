# HARDENING RLS CODEX PÓS-HOTFIX

**Data:** 10/08/2026
**Branch:** `codex/hardening-rls-pos-hotfix`
**Base:** `9eb7cf3c17fdfdc8f1945853a04d29c4f93d4c21`
**Commit inicial das migrations:** `c4f926ca38e1085a29fe73d3cc1982f40e9e4a5b`
**Escopo:** identidade Auth→usuário, RLS explícito, integridade cross-tenant e históricos append-only.

## 1. Resultado

**HARDENING DE RLS/IDENTIDADE/APPEND-ONLY — APLICADO E HOMOLOGADO.**

O Supabase principal `eaeuoynprurmmulzhydt` recebeu exclusivamente as migrations `057–059`. O estado final foi verificado como `001–059 local=remote`, seguido de dry-run com `Remote database is up to date.`

Este resultado não declara a plataforma SaaS integralmente homologada. Permanecem rodadas próprias para comissões, financeiro transacional, FKs/retenção, integração da auditoria central, storage e performance/lint.

## 2. Problemas encontrados

As migrations `053–056` continham quatro classes de risco estrutural:

1. a `056` comparava `empresa_usuarios.usuario_id`, que referencia `public.usuarios.id`, diretamente com `auth.uid()`, que referencia `auth.users.id`;
2. policies `FOR ALL` concediam o mesmo caminho para leitura e escrita, inclusive ao papel `visualizador` por meio do perfil global legado;
3. `caixa_movimentos` e `audit_logs_central` não tinham imutabilidade garantida por trigger de banco;
4. FKs simples aceitavam referências logicamente cross-tenant quando o UUID existia.

Também foi revisado o uso de `SECURITY DEFINER`: helpers canônicos precisavam de `search_path` fixo, referências qualificadas e grants explícitos.

## 3. Migrations criadas e aplicadas

### 057 — identidade e autorização

Arquivo: `supabase/migrations/057_hardening_identidade_autorizacao_helpers.sql`.

- endurece `current_usuario_id()` para resolver `auth.uid()` por `usuarios.auth_user_id`;
- preserva Platform Superadmin somente via vínculo N:N ativo e papel real `super_admin`/`PLATFORM`;
- endurece `is_platform_superadmin`, `is_company_member`, `has_company_role` e `has_company_permission`;
- cria `can_read_tenant_internal` para `admin_empresa`, `gestor`, `consultor` e `visualizador`;
- cria `can_write_tenant_internal` somente para `admin_empresa` ou Platform Superadmin;
- todas as sete funções são `STABLE SECURITY DEFINER`, usam `SET search_path = pg_catalog` e referências schema-qualified;
- `PUBLIC` e `anon` perderam execução; somente `authenticated` e `service_role` receberam grant explícito.

### 058 — RLS explícito dos Macroblocos B–E

Arquivo: `supabase/migrations/058_hardening_rls_macroblocos_b_e.sql`.

Foram substituídas atomicamente as policies existentes de 18 tabelas:

- comercial: `vendas`, `cotas_definitivas`;
- comissão: `comissao_programas`, `comissao_regras_franquia`, `comissao_regras_participantes`, `comissao_previsoes_franquia`, `comissao_previsoes_participantes`;
- financeiro: `financeiro_recebimentos`, `financeiro_recebimento_itens`, `financeiro_pagamentos`, `financeiro_pagamento_itens`, `financeiro_compensacoes`, `caixa_movimentos`;
- gestão/auditoria: `equipes`, `equipe_membros`, `metas_comerciais`, `tarefas_gestao`, `audit_logs_central`.

Foram removidas 46 policies legadas das migrations `053–056`: oito de vendas/cotas, quinze de comissão, dezoito financeiras e cinco de gestão/auditoria. Entre elas estavam todas as variantes `*_superadmin_all`, `*_staff_write` e as cinco `*_tenant_policy` da migration 056.

Foram criadas 68 policies explícitas:

- 16 tabelas mutáveis × `SELECT`, `INSERT`, `UPDATE`, `DELETE` = 64;
- `caixa_movimentos` e `audit_logs_central` × `SELECT`, `INSERT` = 4;
- nenhuma policy `FOR ALL` permaneceu;
- `vendas` e `cotas_definitivas` preservam delete exclusivo do Platform Superadmin;
- `visualizador`, `consultor` e `gestor` têm leitura tenant, mas nenhuma escrita;
- `admin_empresa` escreve somente no próprio tenant;
- Platform Superadmin preserva acesso global, sem depender de perfil legado.

### 059 — integridade cross-tenant e append-only

Arquivo: `supabase/migrations/059_hardening_integridade_append_only.sql`.

Foram criadas cinco funções `SECURITY INVOKER`, com `search_path = pg_catalog`, referências qualificadas e execução revogada de `PUBLIC`/`anon`:

- `validate_comercial_tenant_integrity`;
- `validate_comissao_tenant_integrity`;
- `validate_financeiro_tenant_integrity`;
- `validate_gestao_tenant_integrity`;
- `block_append_only_mutation`.

Dezessete triggers validam venda/cota, programas/regras/previsões, itens financeiros, compensações, origem do caixa, equipes/membros, metas e tarefas. Os triggers `trg_caixa_append_only` e `trg_audit_log_append_only` bloqueiam `UPDATE` e `DELETE` inclusive quando a chamada usa `service_role`; reversões futuras devem ser novos lançamentos, nunca adulteração do histórico.

## 4. Compatibilidade e pré-condições de Produção

Antes da aplicação foi executada auditoria somente leitura no banco principal:

- programa de comissão: 1;
- regra de franquia 4%: 1;
- regra de participante 1,5%: 1;
- previsões de franquia/participante: 0/0;
- inconsistências cross-tenant em cotas, regras, previsões, itens financeiros, compensações, equipes, membros e tarefas: 0 em todas as consultas.

Nenhum dado comercial ou financeiro foi alterado. Nenhuma regra foi criada, removida ou recalculada e nenhuma previsão foi gerada.

As APIs de gestão continuam autenticando usuário, resolvendo tenant/host, validando vínculo/papel/recurso e somente então usando cliente administrativo. O RLS complementa essa defesa e não substitui a validação do uso de `service_role`.

## 5. Homologação isolada

Foi criada uma branch Supabase temporária com clone dos dados:

- nome: `codex-rls-hardening`;
- project ref efêmero: `ljfteutxxxkviolijyof`;
- parent: `eaeuoynprurmmulzhydt`;
- estado durante o teste: `ACTIVE_HEALTHY`.

As migrations `057–059` foram aplicadas primeiro nesse ambiente. O teste transacional `supabase/tests/rls_hardening_057_059.sql` criou fixtures de dois tenants e fez `ROLLBACK` ao final; verificação posterior encontrou zero fixtures residuais.

Matriz real aprovada:

| Perfil | Leitura tenant próprio | Leitura outro tenant | Escrita tenant próprio | Escrita outro tenant |
|---|---:|---:|---:|---:|
| `anon` | bloqueada | bloqueada | bloqueada | bloqueada |
| `visualizador` | permitida | bloqueada | bloqueada | bloqueada |
| `consultor` | permitida | bloqueada | bloqueada | bloqueada |
| `gestor` | permitida | bloqueada | bloqueada | bloqueada |
| `admin_empresa` | permitida | bloqueada | permitida | bloqueada |
| Platform Superadmin | permitida | permitida | permitida* | permitida* |

\* Respeitando as exceções append-only e o delete restrito de vendas/cotas.

O teste percorreu as 18 tabelas, validou as policies explícitas, integridade cross-tenant e bloqueio de `UPDATE`/`DELETE` em caixa/auditoria para `authenticated` e `service_role`. Resultado: `PASS`.

A branch efêmera foi excluída após a homologação. Suas credenciais e recursos temporários deixaram de existir.

## 6. Gates do aplicativo

- `npm test`: **652 PASS / 37 SKIP**, 0 falhas, 112 arquivos pass e 9 skip;
- os 37 testes live permaneceram bloqueados; `RUN_LIVE_PRODUCTION_AUDIT` não foi ativado;
- `npx tsc --noEmit`: PASS;
- `npm run build`: PASS, Next.js 16.3.0, 119 rotas/páginas;
- `npm audit --omit=dev --registry=https://registry.npmjs.org`: 0 vulnerabilidades;
- ESLint: baseline preservada exatamente em **52 erros / 78 warnings**, sem aumento.

Não houve mudança de runtime da aplicação. A homologação equivalente a Preview ocorreu no banco Supabase isolado mais build local completo; nenhum deploy manual Vercel foi necessário para aplicar RLS.

## 7. Aplicação e validação em Produção

O dry-run prévio listou exclusivamente:

- `057_hardening_identidade_autorizacao_helpers.sql`;
- `058_hardening_rls_macroblocos_b_e.sql`;
- `059_hardening_integridade_append_only.sql`.

Após a aplicação:

- `migration list --linked`: `001–059 local=remote`;
- `db push --linked --dry-run`: `Remote database is up to date`;
- policies `FOR ALL` nas 18 tabelas: 0;
- policies CRUD explícitas: 64;
- policies append-only de leitura/inserção: 4;
- grants inseguros dos sete helpers para `PUBLIC`/`anon`: 0;
- regra 4%: 1; regra 1,5%: 1; previsões: 0.

Smoke no domínio canônico:

- `/`, `/grupos`, `/simulador`: 200;
- `/api/public/grupos/sorteios`: 200;
- as seis APIs `/api/admin/gestao/*`: 401 anônimo.

## 8. Sorteios e exclusões de escopo

Não houve alteração de tabela, API, runtime, migration ou policy de sorteios. Em especial, `grupos_sorteios_loteria_public_read` permaneceu intocada. A observação documental anterior sobre campos de autoria não virou requisito, bloqueante ou tarefa.

Também não foram alteradas FKs históricas `ON DELETE CASCADE`, regras de comissão, valores 4%/1,5%, programa existente, correspondência financeira, elegibilidade, RPCs, compensação, estorno ou templates Racon/Sorriso.

## 9. Riscos residuais e parada

- decisões de negócio de comissão e elegibilidade financeira continuam abertas;
- FKs históricas/retention exigem inventário e rodada C própria;
- a trilha central ainda precisa ser integrada aos fluxos de runtime;
- storage e performance/lint permanecem pendentes;
- cenários autenticados E2E no front-end não foram executados em Produção; a autorização foi comprovada diretamente no Postgres isolado com roles/JWT reais e dois tenants.

A rodada encerra aqui. Não foi iniciado trabalho de comissões, financeiro transacional ou templates.
