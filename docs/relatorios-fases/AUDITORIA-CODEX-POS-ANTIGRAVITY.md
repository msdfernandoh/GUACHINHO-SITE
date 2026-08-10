# Auditoria independente Codex pós-Antigravity

**Data:** 10/08/2026  
**Projeto:** `C:\Fernando Hugo\GAUCHINHO SITE`  
**Branch:** `codex/audit-pos-antigravity`  
**Escopo:** todo o delta entre o handoff da Fase 4/E6 e o estado de `main` em 10/08/2026.  
**Regra especial:** sorteios foram somente inventariados/smoke; tabela, API, runtime, RLS e policy `grupos_sorteios_loteria_public_read` não foram alterados.

**SHA de implementação auditado/Preview:** `d13618c`  
**Preview:** `dpl_BTknMJ8xLuk1FNCKuP8wYqK1PSHF` — READY — `https://guachinho-site-rdvz79l2t-hugo-8097s-projects.vercel.app`

## 1. Sumário executivo e ponto exato de handoff

O último estado identificado antes de o Antigravity iniciar a Fase 4/E6 é:

- `HANDOFF_BASE_SHA=6ddbd0ccea0a9dc59cce06b60d5142745b249de9`
- `CURRENT_MAIN_SHA=4c35ba8660927325d676095548870b6b1d8beb0d`
- `CURRENT_FEATURE_F_SHA=6895523`
- `CURRENT_PRODUCTION_SHA=não comprovado pelo metadata disponível da Vercel`
- Produção observada: deployment `dpl_7QFzcKuGNkPUd4hvBp3awDuipYtp`, READY, aliases `gauchinhoconsorcios.com.br` e `www`, criado em 10/08/2026 13:44 -04.
- Delta auditado: **50 commits**, **87 arquivos**, **8.954 inserções** e **963 remoções**, incluindo migrations 049–056 e seis merges.

Evidência do handoff: `6ddbd0c` é o fechamento da homologação de grupos vinculados à administradora global; o commit imediatamente seguinte, `7ea813f`, inicia a Fase 4/E6. O SHA de Produção não foi inferido a partir do relatório: a inspeção da Vercel não expôs vínculo Git suficiente para comprová-lo.

## 2. Conclusão

**AUDITORIA DO CODEX BLOQUEADA POR PROBLEMA MATERIAL.**

A branch corrige vulnerabilidades inequívocas e está apta a Preview, mas o projeto não pode ser declarado pronto para homologação final de Produção enquanto permanecerem:

1. decisões não formalizadas do motor de comissões;
2. recebimentos/pagamentos não atômicos e elegibilidade financeira não garantida no banco;
3. migration 057 ainda não aplicada;
4. comparação CLI local/remoto não comprovada por credencial de pooler inválida;
5. baseline de lint/typecheck com falhas anteriores à auditoria.

## 2.1. Separação formal dos três estados

### PRODUCTION_ATUAL_ANTIGRAVITY

- Alias: `https://gauchinhoconsorcios.com.br` / `https://www.gauchinhoconsorcios.com.br`.
- Deployment efetivo: `dpl_7QFzcKuGNkPUd4hvBp3awDuipYtp`, target `production`, READY.
- URL gerada: `https://guachinho-site-3n1czvsxk-hugo-8097s-projects.vercel.app`.
- `origin/main`: `4c35ba8660927325d676095548870b6b1d8beb0d`.
- SHA efetivamente associado ao deployment: **não comprovado**, pois o metadata retornado pela Vercel não contém Git SHA.
- O SHA reportado `4c35ba800f40cf9fefeafe30c000f074d284a2ee` não existe; somente o prefixo curto `4c35ba8` coincide com a main real.
- O ID reportado `dpl_3n1czvsxk` não é um Deployment ID; `3n1czvsxk` é parte da URL. Nenhum rollback foi realizado.

### AUDIT_BRANCH_CODEX

- Branch: `codex/audit-pos-antigravity`, criada a partir da main real `4c35ba866...`.
- Correções permanecem isoladas; não houve merge em main, migration remota ou deploy Production.
- SHA de implementação auditado: `d13618cc4c173965e89303365fc57fe0e1d55060`.

### CODEX_PREVIEW

- Deployment: `dpl_BTknMJ8xLuk1FNCKuP8wYqK1PSHF`, target `preview`, READY.
- URL: `https://guachinho-site-rdvz79l2t-hugo-8097s-projects.vercel.app`.
- As seis APIs de gestão retornaram `Não autenticado` sem sessão do aplicativo; a Produção Antigravity retornava dados.

## 3. Matriz comparativa por fase/macrobloco

| Bloco | Declarado antes | Evidência real | Veredito Codex |
|---|---|---|---|
| Fase 4 restante | confidencialidade/isolamento homologados | arquitetura de concessão e host majoritariamente presente; CLI remoto não reconfirmado | correto com ressalva |
| Fase 5 / A | catálogo global + overlay tenant | estruturas 052 presentes; Empresa B real sem concessão | correto com ressalva |
| B | venda/cota idempotentes | retorno idempotente vazava cross-tenant; fluxo não atômico; defaults monetários fictícios | corrigido parcialmente |
| C | motor configurável, idempotente | criava 4%/1,5% automaticamente; ignora vigência; seleção de participante não específica; sem integração runtime | problema material |
| D | financeiro atômico, elegibilidade e caixa append-only | várias chamadas REST; erros ignorados; pagamento não exige recebimento; caixa atualizável/deletável | problema material |
| E | dashboards, metas, equipes, tarefas, auditoria | seis APIs públicas; status/coluna inexistentes; meta mock 50%; RLS 056 usa identidade errada | corrigido no código/migration |
| F | segurança geral, onboarding e recovery homologados | claims excedem evidência; testes live escreviam em Produção; PITR/restore não comprovados | não comprovado |

## 4. Achados priorizados

| ID | Pri. | Arquivo/tabela | Encontrado e impacto | Correção/teste |
|---|---|---|---|---|
| C-01 | P0 | `src/app/api/admin/gestao/*` | seis APIs respondiam sem login; equipes/metas/tarefas permitiam mutação com `service_role`; GETs confirmados HTTP 200 em Produção | guard central, tenant por host, vínculo, RBAC, same-origin, Zod e `no-store`; teste Codex |
| C-02 | P1 | migration 056 | `empresa_usuarios.usuario_id = auth.uid()` confundia Auth UUID com `usuarios.id`; policies `FOR ALL` sem capacidade | migration 057 usa `current_usuario_id()`, leitura staff e escrita master |
| C-03 | P1 | migrations 053–055 | `visualizador` herdava escrita por `is_staff()` em vendas, comissões e financeiro | policies de escrita substituídas por `can_manage_empresa()` master/superadmin |
| C-04 | P1 | `caixa_movimentos`, `audit_logs_central` | “append-only” era apenas declaração; UPDATE/DELETE eram possíveis | triggers de imutabilidade na 057 |
| C-05 | P1 | `public-json-ld.tsx` | conteúdo do banco podia encerrar `<script>` e executar XSS persistido | serialização escapa `<` para `\u003c`; teste independente |
| C-06 | P1 | `vendas-service.ts` | checagem idempotente retornava venda/cota de outro tenant antes da validação | query escopada por `empresa_id`; cota íntegra obrigatória; teste de ordem |
| C-07 | P1 | `comissoes-service.ts` | aplicação criava programa e regras 4%/1,5% sem decisão do proprietário | auto-criação removida; ausência de configuração e `valor_fixo` não homologado falham explicitamente |
| C-08 | P1 | `financeiro-service.ts` | recebimento/pagamento/itens/previsão/caixa não formam transação; retry pode duplicar | não corrigido sem redesenho/RPC e decisão financeira; bloqueador |
| C-09 | P1 | financeiro | participante pode ser pago sem recebimento correspondente; código marca previsão elegível depois do pagamento | não corrigido parcialmente; exige RPC transacional e regra de correspondência aprovada |
| C-10 | P1 | migrations 053–056 | FKs históricas usam `ON DELETE CASCADE` para empresa/venda/comissão/financeiro/audit | risco documentado; alteração estrutural requer plano de retenção e auditoria de dados |
| C-11 | P1 | gestão | IDs de gestor/membro/alvo/responsável/origem aceitavam outro tenant | validação DAL + triggers 057 para recursos cross-tenant |
| C-12 | P2 | dashboards/metas | status `efetivada` não existe; coluna `valor_previso` não existe; média de metas fixada em 50 | `confirmada`, `valor_previsto` e apuração canônica |
| C-13 | P2 | testes B–F | nove suítes carregavam `.env.local`, usavam `service_role` e mutavam Produção sem transação/finally | opt-in `RUN_LIVE_PRODUCTION_AUDIT=true`; padrão local seguro |
| C-14 | P2 | Empresa B | testes usavam UUID fictício `e200...`, portanto o cenário negativo não testava a Empresa B real | substituído por `8e4e13f9-80e6-44db-a21b-584a43b6f024` nas suítes live |
| C-15 | P2 | Produção | seis leads de fixture permaneceram; três têm propostas vinculadas | nenhuma exclusão feita para preservar dados; limpeza exige revisão dos três vínculos |
| C-16 | P2 | `supabase/.temp` | arquivos locais com credenciais e bypass em texto claro, não versionados | pasta adicionada ao `.gitignore`; arquivos não removidos sem autorização de custódia |
| C-17 | P2 | auditoria central | tabela existe, mas runtime quase não chama `logAuditEvent`; correlation ID aparece essencialmente em teste | não declarar cobertura ponta a ponta; integração pendente |
| C-18 | P2 | relatórios/dashboards | agregação via listas completas, pouca paginação e N+1 de metas | risco de escala; não bloqueia correção P0, requer queries agregadas/RPC |
| C-19 | P2 | lint/testes | `npm run lint`: 52 erros/78 warnings; typecheck original revelou 21 erros em testes antigos | testes foram separados do tsconfig de Produção; baseline lint deve ser saneado em rodada própria, sem tocar sorteios |
| C-20 | OBS | documentação | declarava “nenhum risco” e nomes de tabelas de comissão incorretos | arquitetura atualizada factual e condicionalmente |
| C-21 | P1 | `next@16.2.9` | auditoria npm apontou bypass de Proxy/Middleware e outras vulnerabilidades altas em dependências de Produção | Next/ESLint config 16.3.0; `npm audit --omit=dev` passou com 0 vulnerabilidades |

## 5. Arquitetura, administradoras, concessões e catálogo

- Confirmado no modelo: Racon é administradora global; Gauchinho é empresa/tenant. Não foi encontrada justificativa para tratar Gauchinho como administradora.
- `administradoras`, `grupos_consorcio`, `grupos_cotas` e modalidades são globais; `empresa_administradoras` concede e `empresa_grupos_config` sobrepõe apresentação local.
- A governança de concessões está concentrada em plataforma/superadmin. Nenhuma concessão foi criada para Empresa B.
- `grupos_cotas` e `cotas_definitivas` são entidades distintas no schema auditado.
- `usuarios` (login) e `participantes_comerciais` (identidade comercial) são distintos; a migration 056 violava essa arquitetura na resolução de identidade e foi corrigida pela 057.
- Parceiros pertencem ao tenant via `organizacoes_parceiras.empresa_id`; os novos triggers de gestão impedem referências cruzadas.

## 6. Multi-tenant, host, RLS, service role e IDOR

- O host/proxy continua sendo autoridade para tenant; as APIs corrigidas não aceitam `empresa_id` por query/body/header.
- `createAdminClient` foi classificado como **risco** nos serviços B–E por depender da disciplina do chamador. Os módulos foram marcados `server-only`; as seis APIs agora validam auth/context/capability/recurso antes da operação privilegiada.
- Cenários IDOR corrigidos diretamente: contratação/venda idempotente; gestor/membro/equipe/meta/tarefa/origem; tenant hardcoded nas APIs.
- Cenários ainda não garantidos no banco: consistência cross-tenant completa de venda com lead/proposta/contratação/grupo/cota e transações financeiras. A migration 057 reduz escrita direta, mas não substitui uma RPC comercial/financeira atômica.
- `anon`, usuários reais de cada perfil e storage cross-tenant não puderam ser exercitados integralmente sem credenciais de teste isoladas; não foram simulados como PASS.

## 7. CRM, propostas, contratações, vendas e cotas

- Migrations 053 adicionaram `empresa_id` nullable a leads/propostas/contratações, backfill Gauchinho e FKs com cascade. `NOT NULL` e atribuição histórica não foram forçados para evitar corrupção de legado.
- Propostas têm risco de snapshot incompleto a confirmar em fluxo real; alteração futura de catálogo não foi testada com uma transação isolada remota.
- Contratação é validada contra catálogo concedido no serviço, mas a conversão de venda continua composta por várias chamadas REST.
- Corrigidos: vazamento idempotente, venda sem cota íntegra e valores mágicos R$100.000/180/R$650. Valores ausentes agora falham.
- Pendente: RPC única para venda + cota + contratação + lead e constraint de opção pertencente ao grupo/tenant.

## 8. Comissões e previsões

- Franquia e participante têm tabelas separadas, mas o runtime seleciona regras de forma insuficiente.
- `vigencia_inicio`/`vigencia_fim` e precedência de versões não são efetivamente aplicadas.
- A regra de participante não é filtrada de modo completo por participante/organização/tipo; pode escolher uma regra ativa arbitrária.
- A criação automática de 4% e 1,5% foi removida. O registro já existente em Produção não foi apagado porque pode ter sido posteriormente aceito e a decisão é comercial.
- `valor_fixo` não tinha implementação semântica; agora falha explicitamente em vez de calcular sobre crédito.
- Idempotência da franquia tem UNIQUE por venda/etapa; participante não possui constraint equivalente robusta e sofre corrida.
- Geração de previsão não está integrada automaticamente à conversão de venda; os testes eram o principal chamador.

**Decisão necessária:** programa aplicável por administradora/modalidade, percentuais, base, precedência/versão, cronograma e regra específica/genérica de participante.

## 9. Financeiro, pagamentos, compensações, caixa e estornos

- Tabelas 055 usam `numeric(15,2)`, mas o TypeScript converte para `Number`, sujeito a arredondamento binário.
- Recebimento parcial, pagamento, compensação e caixa são sequências não atômicas. Falha intermediária deixa estado parcial.
- Não existem chaves de idempotência confiáveis para double-click/retry.
- A soma dos itens não era garantida contra o total; a 057 adiciona apenas checks de sinal/consistência de novos valores, não uma regra de soma cross-row.
- Pagamento não comprova recebimento correspondente da administradora. A regra aprovada de elegibilidade não está implementada de modo seguro.
- Caixa passa a ser append-only na 057. Estorno deve inserir reversão; UPDATE/DELETE é bloqueado.
- Casos 10.000/6.000/4.000 e compensações 2.000/500 e 800/2.000 não foram homologados porque executar o serviço atual contra Produção criaria movimento fictício e não atômico.

**Decisão/implementação necessária:** definir correspondência recebimento→previsão→participante e criar RPCs transacionais com locks, numeric e idempotency keys.

## 10. Equipes, metas, tarefas, dashboards, relatórios e auditoria

- Equipes: valida gestor/membro do mesmo tenant no DAL e DB; criação ainda usa compensação se vínculo do gestor falhar, não transação real.
- Metas: alvo cross-tenant bloqueado; realizado deriva de dados canônicos. Status e coluna foram corrigidos e o mock 50% removido.
- Tarefas: responsável/equipe/origem cross-tenant bloqueados; payload validado; atraso usa ISO/UTC e merece regra explícita de timezone de negócio.
- Dashboards: consultas agora usam `confirmada` e `valor_previsto`; resultados financeiros continuam condicionados à correção do motor D.
- Relatórios: endpoint protegido, mas CSV/export de gestão ainda não é um pipeline completo com paginação e defesa de formula injection.
- Auditoria: tabela e listagem existem; cobertura de eventos reais e correlation ID não é ponta a ponta.

## 11. Segurança: XSS, CSRF, SQL, cache, storage, functions e secrets

- XSS JSON-LD corrigido com escape de `<`.
- POST/PATCH de gestão agora exigem Origin igual ao host/protocolo encaminhado e sessão autorizada.
- Não foi encontrada concatenação SQL nova nos fluxos examinados; PostgREST parametriza filtros.
- Cache de resolução de tenant é tenant-aware nos testes existentes; respostas de gestão recebem `private, no-store`.
- Storage policies não foram comprovadas por testes reais de usuários de dois tenants; status: **não comprovado**.
- Functions 057 usam `SECURITY DEFINER`, `search_path = public, pg_temp`, `REVOKE PUBLIC` e grants explícitos.
- Busca no Git não encontrou segredo real versionado; encontrou nomes de variáveis e documentação. `supabase/.temp` é risco local fora do Git.
- O framework foi atualizado de Next 16.2.9 para 16.3.0 após o audit apontar bypass de Proxy/Middleware; dependências de Produção ficaram com 0 vulnerabilidades conhecidas no npm audit.

## 12. Migrations e schema real

- Auditadas individualmente: 049, 050, 051, 052, 053, 054, 055 e 056.
- Migration criada: `057_auditoria_codex_hardening_rls_integridade.sql`.
- Migration aplicada: **não**.
- Remote observado via REST: tabelas de 053–056 existem. Isto não prova igualdade integral de schema, policies, functions e grants.
- `supabase migration list --linked`: falhou por senha do pooler armazenada inválida.
- `supabase db push --linked --dry-run`: falhou pelo mesmo motivo.
- Nenhum `migration repair`, push de DB ou escrita estrutural em Produção foi realizado.

## 13. Performance, onboarding, hardcodes, backup e recovery

- Há N+1 na apuração das metas e agregações em memória sem paginação no financeiro/dashboard.
- As APIs de gestão hardcodavam o UUID Gauchinho; corrigido para tenant do host.
- UUIDs Gauchinho/Racon permanecem em fallbacks legados e testes; cada ocorrência deve ser tratada como legado explícito, não onboarding genérico.
- Onboarding de novo tenant não foi executado. Empresa B real permanece inativa/em treinamento, sem concessão e sem dados Racon observados.
- Runbook de backup/PITR existe, mas disponibilidade de PITR e restore não foi verificada; nenhum restore foi tentado em Produção.

## 14. Testes antigos revisados e testes Codex

Baseline antes da correção: 118 arquivos e 668 testes PASS, porém as suítes B–F usavam `service_role` real e algumas escreviam em Produção. Quantidade não equivalia a cobertura de RLS/autorização/transação.

Resultado seguro atual:

- `npm test`: **110 arquivos PASS, 9 SKIP; 639 PASS, 37 SKIP (676 total)**.
- suíte nova `audit-codex-pos-antigravity.test.ts`: **8/8 PASS**.
- `npm run build`: **PASS**, 119 rotas/páginas (Next 16.3.0).
- `npm audit --omit=dev`: **PASS**, 0 vulnerabilidades de Produção.
- `npm run lint`: **FAIL**, 52 erros e 78 warnings no baseline amplo.
- `npx tsc --noEmit`: **PASS** para código de Produção; os testes ficam a cargo do Vitest. Antes da separação, o comando revelou 21 erros de tipagem em testes/mocks antigos, mantidos como dívida explícita.

Os 37 testes live só executam com opt-in explícito. Eles não devem ser usados em Produção até serem convertidos para ambiente isolado/rollback.

## 15. Dados de Produção e resíduos

- Encontrados seis leads exatamente `Cliente Audit E2E Macrobloco B` com e-mails `audit.*@gauchinho.com.br`.
- Três referências em `propostas` impedem afirmar que a exclusão é segura; nenhum registro foi apagado.
- Existe um programa “Programa Padrão de Comissão” e regra 4% observados. Não foram removidos por depender de confirmação do proprietário.
- Nenhuma venda, recebimento, pagamento, compensação ou caixa fictício foi criado pelo Codex.

## 16. Estado de entrega

| Tipo | Estado |
|---|---|
| Encontrado | P0 APIs públicas; RLS/IDOR/XSS/dashboard/testes live; problemas materiais C/D |
| Corrigido no código | auth/tenant/RBAC/CSRF/input, XSS, dashboard, idempotência tenant, validações de gestão, defaults fictícios |
| Migration criada | 057 |
| Migration aplicada | não |
| Pushed | sim, branch `origin/codex/audit-pos-antigravity` |
| Preview deployado | sim; `dpl_BTknMJ8xLuk1FNCKuP8wYqK1PSHF`, READY |
| Homologado em Preview | parcial: build PASS e seis APIs retornaram `Não autenticado` sem sessão; fluxos C/D não homologados |
| Produção | não alterada; continua vulnerável até merge/deploy/migration autorizados |

## 17. Próximas decisões obrigatórias

1. Confirmar regras de comissões (percentuais, base, vigência, versão, participante/parceiro e cronograma).
2. Autorizar desenho de RPCs transacionais para venda, recebimento, pagamento, compensação e estorno.
3. Definir retenção/FKs `RESTRICT` para históricos e política de exclusão de tenant.
4. Fornecer/renovar acesso CLI seguro do Supabase para dry-run e aplicação controlada da 057.
5. Decidir se os seis leads/três propostas de fixture e o programa padrão podem ser removidos.
6. Sanear lint/typecheck antigo em rodada separada, preservando a proibição de alterações em sorteios.

## 18. Recomendação

Não promover esta auditoria diretamente a Produção. Primeiro: Preview + smoke anônimo/autenticado; decisão formal C/D; RPCs transacionais; aplicação controlada da 057; RLS real por perfis; só então nova homologação e autorização explícita de Production.
