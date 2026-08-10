# HOTFIX CODEX PÓS-AUDITORIA

**Data:** 10/08/2026  
**Base verificada:** `origin/main` em `4c35ba8660927325d676095548870b6b1d8beb0d`  
**Branch:** `hotfix/codex-security-pos-antigravity`  
**Commit do hotfix:** `ed39a18`  
**Escopo:** correção urgente de segurança/isolamento; nenhuma regra financeira ou comercial nova.

## 1. Estados separados

- `PRODUCTION_ATUAL_ANTIGRAVITY`: versão implantada antes deste hotfix, auditada como vulnerável nas seis APIs de gestão.
- `AUDIT_BRANCH_CODEX`: `hotfix/codex-security-pos-antigravity`, criada limpa a partir da `origin/main`.
- `CODEX_PREVIEW`: deploy `dpl_6jAAvsFzbKTs8Mo2YBQxKftyd9zz`, READY, em `https://guachinho-site-8zhjv6qsf-hugo-8097s-projects.vercel.app`.
- `PRODUCTION_CORRIGIDA_CODEX`: pendente do merge/deploy controlado registrado na seção 8.

## 2. Achado material e correção

O estado Antigravity expunha anonimamente:

- `/api/admin/gestao/dashboard`
- `/api/admin/gestao/relatorios`
- `/api/admin/gestao/auditoria`
- `/api/admin/gestao/equipes`
- `/api/admin/gestao/metas`
- `/api/admin/gestao/tarefas`

As três últimas rotas também possuíam mutações executadas com cliente administrativo. O hotfix acrescenta:

- autenticação obrigatória;
- tenant resolvido pelo host, sem UUID de tenant hardcoded;
- vínculo ativo em `empresa_usuarios`;
- autorização pelo `papel` do vínculo N:N (não pelo perfil global legado);
- leitura para `admin_empresa`, `gestor`, `consultor` e `visualizador`;
- escrita somente para `admin_empresa` ou superadmin de plataforma;
- proteção same-origin nas mutações e validação Zod;
- validação de referências de equipe, participante e responsável no mesmo tenant;
- `Cache-Control: no-store` nas leituras administrativas.

Também foram incluídas correções isoladas para XSS em JSON-LD persistido, idempotência de vendas escopada por tenant, remoção de valores comerciais inventados, correções de status/coluna/métrica dos dashboards, isolamento `server-only` e Next.js `16.3.0`.

## 3. Sorteios — preservação obrigatória

Não houve alteração de tabela, migration, RLS, policy, API ou runtime de sorteios. Em especial, `grupos_sorteios_loteria_public_read` permaneceu intocada. `/api/public/grupos/sorteios` foi somente objeto de smoke test de leitura.

## 4. Supabase e migration 057

Foi usado o binário oficial Supabase CLI `2.111.0`, com credencial injetada pelo ambiente Vercel sem impressão de segredo.

- `migration list --linked`: migrations `001–056` alinhadas local/remoto;
- `db push --linked --dry-run`: banco atualizado, sem migration, seed ou role pendente;
- nenhuma migration foi aplicada;
- a migration monolítica 057 foi excluída integralmente deste hotfix.

Classificação da proposta 057:

- **A — urgente e necessária:** correção da identidade `auth.uid()` versus `usuarios.id`, restrição de mutações de gestão e capacidade por papel. A proteção imediata das APIs foi resolvida em código; o endurecimento RLS continua pendente de migration própria e pequena.
- **B — independente e tecnicamente segura:** `SECURITY DEFINER` com `search_path` fixo/revogação de execução, validações cross-tenant no banco e append-only de caixa/auditoria. Deve virar migrations forward-only separadas.
- **C — decisão estrutural:** revisão de FKs históricas com `CASCADE`, priorizando `RESTRICT` e exclusão lógica. Não aplicar sem plano de compatibilidade e dados.
- **D — depende da arquitetura financeira/comercial:** constraints numéricas, semântica de liquidação, elegibilidade, compensação, estorno e RPCs transacionais. Não implementado.

Conclusão: o P0 das APIs não depende da 057. O banco 001–056 não deve ser declarado integralmente homologado enquanto a futura migration A/B não for desenhada, revisada e testada.

## 5. Evidências de validação

- `npm test -- --run`: **643 PASS**, **37 SKIP**, 0 falhas (111 arquivos pass, 9 skip).
- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS; Next.js **16.3.0**, 119 rotas/páginas.
- `npm audit --omit=dev --audit-level=high`: **0 vulnerabilidades de produção**.
- ESLint: baseline preservado em **52 erros / 78 warnings**; dívida preexistente, sem aumento.
- Preview Vercel: READY; build remoto PASS.
- Logs do Preview após smoke: nenhum erro ou warning encontrado.

O relatório anterior de 668/668 não foi reproduzido. A branch limpa executa 643 testes não-live após a adição de cinco testes do hotfix; a divergência é mantida como achado documental, sem reclassificar skips como passes.

### Testes live bloqueados por padrão (37)

Todos exigem `RUN_LIVE_PRODUCTION_AUDIT=true`, evitando acesso/escrita acidental em Produção:

- `audit-macrobloco-b.test.ts`: 4
- `audit-macrobloco-c.test.ts`: 3
- `audit-macrobloco-d.test.ts`: 3
- `audit-macrobloco-e.test.ts`: 5
- `audit-macrobloco-f.test.ts`: 5
- `audit-fase5-end-to-end.test.ts`: 7
- `vendas/vendas-service.test.ts`: 3
- `comissoes/comissoes-service.test.ts`: 4
- `financeiro/financeiro-service.test.ts`: 3

### Matriz de acesso

- Anônimo no Preview real: seis APIs retornaram `401 {"error":"Não autenticado."}`.
- Tenant errado: teste determinístico PASS (`missing_tenant`).
- Autenticado sem permissão: teste determinístico PASS; visualizador não escreve mesmo se o perfil legado global for master.
- Tenant correto/autorizado: testes determinísticos PASS para leitura interna e escrita exclusiva de `admin_empresa`.

Não foi feito login/impersonação: o navegador disponível não tinha sessão Vercel/aplicação. Portanto, os três cenários autenticados estão comprovados na função de política executável, não como E2E remoto. Criar sessão artificial de usuário em Produção seria risco desnecessário.

## 6. Parte B — diagnóstico e plano, sem implementação

### Fixtures/configuração real encontrada (somente leitura)

- programa ativo: `9db42224-a733-42ac-b0dd-1bb89f30a74d` → empresa `7170f38e-15dd-4b19-8588-51e9a9cf0d4c`;
- regra de franquia: `517a13ce-0da4-4e4e-ba33-d9d4a24e6e73` → programa acima, versão 1, base `credito`, 4%;
- regra de participante: `10afd502-b9ad-4633-99e0-e9b7cce63860` → mesmo programa, participante `a74da3c4-4d1f-49a6-b2fd-a6b48a5fcd00`, base `credito`, 1,5%;
- previsões de franquia: 0; previsões de participante: 0; logo não há snapshots históricos que provem uso efetivo dos defaults 4%/1,5%.

O serviço deixou de criar programa/regras ou valores 4%/1,5% automaticamente. Se configuração ativa estiver ausente ou ambígua, a conversão falha explicitamente.

### Decisões que o proprietário precisa fornecer

1. A comissão da franquia varia por administradora, modalidade, plano, vigência ou combinação desses campos?
2. Qual é a precedência entre regra genérica e específica, e como versionar a regra vigente?
3. A base pode ser crédito, valor fixo, comissão recebida ou outra? Como arredondar e distribuir etapas?
4. Participante e organização parceira podem coexistir na mesma venda? Há rateio ou prioridade?
5. O repasse fica elegível proporcionalmente a cada recebimento ou somente após quitação integral da etapa da franquia?
6. Como tratar cancelamento, inadimplência, estorno parcial, estorno após pagamento e saldo negativo?

### Correspondência financeira proposta para decisão

Cada item de recebimento deve apontar uma previsão de franquia. Essa previsão já identifica `empresa`, `venda`, `cota`, `ordem_etapa` e `competencia`. Uma previsão de participante só pode ser elegível quando coincidir nesses mesmos eixos. O valor liberado deve ser derivado do valor efetivamente liquidado, nunca de seleção solta por UUID. Falta a decisão do item 5 para definir se a liberação é proporcional ou integral.

### RPCs transacionais — desenho futuro

Separar, com idempotency key, locks e validação numérica:

1. conversão comercial (`contratacao` → `venda` + `cota` + snapshots);
2. recebimento/liquidação e cálculo de elegibilidade;
3. pagamento/compensação e lançamento append-only no caixa;
4. estorno por evento compensatório, sem update/delete do histórico.

Nenhuma RPC foi criada nesta rodada.

### FKs e exclusão

Há `CASCADE` em programa→regras, venda→previsões, participante→regra e recebimento/pagamento→itens. Para registros financeiros/históricos, a proposta é migrar para `RESTRICT` e exclusão lógica; `SET NULL` pode permanecer apenas quando a perda da referência não destrói a capacidade de auditoria. A mudança exige inventário de dados órfãos e migration C específica.

### Auditoria, storage e performance

- `logAuditEvent` existe, mas a busca encontrou chamada apenas no teste live; os fluxos comerciais/financeiros reais ainda não escrevem na trilha central.
- O plano de storage deve testar upload/leitura/negação/delete por bucket, tenant e papel usando fixtures descartáveis em ambiente não produtivo.
- Backlog de performance: índices compostos pelos eixos de liquidação, paginação de dashboards/auditoria, evitar N+1 na apuração de metas e medir planos com `EXPLAIN (ANALYZE, BUFFERS)` em dados representativos.

## 7. Smoke do Preview

- seis APIs administrativas: 401 anônimo;
- `/`: 200;
- `/grupos`: 200;
- `/simulador`: 200;
- `/api/public/grupos/sorteios`: 200, sem alteração de comportamento.

## 8. Merge, deploy e smoke de Produção

Pendente de execução controlada após este relatório. Preencher com SHA de `main`, deployment ID/URL, resultados das dez rotas e inspeção de logs.

## 9. Riscos residuais

- RLS da migration 056 ainda contém identidade incorreta (`empresa_usuarios.usuario_id = auth.uid()`) e policies amplas `FOR ALL`; o hotfix mitiga as seis APIs, mas não substitui a migration A/B.
- Cenários autenticados não foram executados E2E remotamente por ausência de sessão segura.
- dívida de lint preexistente;
- regras financeiras/comerciais aguardam decisão explícita;
- trilha central ainda não está integrada aos fluxos reais.

