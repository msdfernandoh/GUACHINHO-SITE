# Relatório de Fase — Platform Administradoras V2

## Estado canônico

- Main promovida: `origin/main@ad297e62232618d609fb579caba7656dd848e6e7`.
- Branch de implementação: `codex/platform-administradoras-v2`.
- Commit inicial da implementação: `271c5af`.
- Migration: `083_platform_administradoras_hub_catalogo.sql`.
- Production: migrations `001–083`; a 083 foi aplicada por dry-run exclusivo seguido de `db push` oficial.
- Supabase isolado vigente: `bwwgbmiwtrglbtxsdooi`, branch `codex-platform-administradoras-v2-083-r2`, associada à branch Git da fase.
- Provisionamento anterior descartado: `npcdbkgnibootdixbpwq` falhou antes de executar migrations (`Pulling migrations from database`, conexão IPv6 recusada) e foi removido sem evidência ou dados de homologação.
- Backfill: não executado.

## Implementação

`/platform/administradoras` tornou-se a raiz do catálogo global de cada Administradora:

- lista dedicada, criação e Dados gerais;
- Tipos com edição, ativação/inativação, duplicidade lógica e exclusão segura;
- Modalidades com edição, ativação/inativação e relacionamento N:N com Tipos;
- Curvas múltiplas e versionadas, editor estruturado de faixas, vigência, status e escopos N:N de Tipos/Modalidades;
- Modelos/Tabelas Master por Tipo e percentual de referência, com distribuição por Modalidade e referência às regras canônicas existentes;
- Programas da Franqueadora em rotas Platform-native, com Tipo, Modalidade, comissão, vigência, Curva opcional, cronograma, versão, status e ações governadas;
- Grupos internos da Administradora com Tipo, Modalidades, Produtos, status, prontidão, origem e acesso ao editor canônico do Grupo;
- histórico restrito à Administradora e às entidades relacionadas;
- prontidão separada entre catálogo-base e Grupos pendentes.

O Modelo Master não calcula comissão. A matemática permanece em `comissao_programas`, `comissao_regras_franquia` e `comissao_regra_etapas`; a 083 adiciona somente governança/referências e a Curva opcional da regra.

## Segurança e preservação

- RPCs de mutação exigem `is_platform_superadmin()`.
- Novas tabelas usam RLS com policies explícitas de `SELECT`, `INSERT`, `UPDATE` e `DELETE`; não foi criada policy genérica `FOR ALL` para elas.
- Deleções consultam Grupos, Produtos, regras, vínculos, previsões e snapshots de Venda.
- Curva, Modelo ou Programa homologado/usado evolui por inativação ou nova versão.
- Migrations 001–082 não foram alteradas.
- Nenhuma Venda, Cota, previsão, comissão, pagamento ou snapshot histórico é recalculado pela 083.

## Gates locais

| Gate | Resultado |
|---|---|
| TypeScript (`npx tsc --noEmit`) | PASSOU |
| Testes focados | 9/9 PASSARAM |
| Suíte completa | 757 passaram; 37 skipped; 0 falhas |
| Lint do escopo | PASSOU |
| Build Next.js | PASSOU; 134 páginas geradas |
| `npm audit --omit=dev` | 0 vulnerabilidades |
| `git diff --check` | PASSOU |

## Homologação Supabase e E2E

O provisionamento isolado vigente foi criado com clone de dados e reconciliado em `001–082` antes da aplicação. O dry-run apresentou somente a `083`, a aplicação terminou com sucesso e o histórico remoto do isolado passou a `001–083`. O Supabase principal não foi vinculado nem alterado.

O script autenticado [`supabase/tests/platform_administradoras_v2_083_e2e.sql`](../../supabase/tests/platform_administradoras_v2_083_e2e.sql) criou no isolado uma Administradora sintética completa e comprovou:

- persistência de Administradora, Tipo, três Modalidades ligadas N:N ao mesmo Tipo, Curva, Modelo Master homologado, Programa ativo, três Regras canônicas e Grupo/Produto com valores por Modalidade;
- exclusão definitiva permitida para Tipo, Modalidade e Curva livres e bloqueada para entidades utilizadas;
- Curva opcional por Regra: Integral e abaixo de 59 com Curva; Reduzida 60–99 sem Curva;
- recusa real de RPC de mutação para identidade sem papel Platform Superadmin;
- após reload, três resultados independentes: Integral = `2500`, uma etapa e Curva; Reduzida 60–99 = `1750`, duas etapas e sem Curva; abaixo de 59 = `1250`, duas etapas, Curva e etapa de contemplação;
- Modelo Master `HOMOLOGADO` e Programa `ATIVO` preservados após reload;
- Racon preservada com os Tipos canônicos `IMOVEL` e `AUTOMOVEIS`, as três Modalidades canônicas, três Programas existentes, uma Curva e seis Regras. O clone já continha ainda o Tipo ativo `TESTE`; ele é dado preexistente, não duplicado dos dois Tipos canônicos, e não foi removido nem alterado porque esta fase proíbe backfill/limpeza histórica.

Durante o E2E foram encontrados e corrigidos antes da consolidação dois defeitos da própria `083`: o nome singular incorreto de `grupos_modalidades_disponiveis` e a ordem de exclusão das faixas/associações de uma Curva livre. As execuções que revelaram os defeitos sofreram rollback; a persistência registrada acima ocorreu somente após as RPCs corrigidas no isolado.

## Preview e evidências visuais

O Preview final está `READY` no deployment `JC2KegPe3rpPtQ55Udxc4J7NoTsc`, SHA `8998c49`, com alias canônico [guachinho-site-git-codex-platform-ad-5eeb84-hugo-8097s-projects.vercel.app](https://guachinho-site-git-codex-platform-ad-5eeb84-hugo-8097s-projects.vercel.app). Foram configurados cinco overrides restritos a `Preview` + branch `codex/platform-administradoras-v2`: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `PLATFORM_HOST`. Os quatro valores Supabase pertencem exclusivamente ao isolado `bwwgbmiwtrglbtxsdooi`; nenhum valor de Production foi alterado.

Smokes read-only:

- `/login`: HTTP `200`;
- `/platform/administradoras` sem sessão: HTTP `307` para `/login?next=/platform`, comprovando o host Platform correto sem liberar acesso anônimo;
- build Vercel: `READY`, 134 rotas e zero vulnerabilidades na instalação.

Evidências capturadas:

- [`supabase-isolado-e2e-persistencia.png`](../evidencias/platform-administradoras-v2/supabase-isolado-e2e-persistencia.png): consulta autenticada após reload com as três Modalidades, valores, Modelo, Programa, Curva e etapas;
- [`vercel-preview-ready.png`](../evidencias/platform-administradoras-v2/vercel-preview-ready.png): deployment final `READY`;
- [`vercel-preview-login-platform.png`](../evidencias/platform-administradoras-v2/vercel-preview-login-platform.png): gate Platform do Preview isolado.

A homologação visual interna autenticada continua bloqueada somente pela ausência de uma sessão/credencial Platform de homologação no domínio Preview. Nenhuma senha real foi alterada e nenhuma conta administrativa temporária foi criada de forma improvisada. Após o responsável autenticar a sessão já aberta no Preview, faltam capturar as telas internas de lista/detalhe/abas e fechar este gate.

## Produção

A promoção foi autorizada e concluída em `18/08/2026`.

- Supabase Production `eaeuoynprurmmulzhydt`: histórico remoto `001–083`, com a migration `083_platform_administradoras_hub_catalogo.sql` aplicada isoladamente.
- Não houve fixture, backfill, limpeza de dado legado, exclusão de dados reais, alteração de migrations `001–082` ou recálculo/regeneração de Venda, Cota, comissão, previsão ou snapshot histórico.
- Vercel Production: deployment `dpl_9GhcpmEEgo4HCHACcJYcT4EWW6rc`, estado `READY`, URL [guachinho-site-6bwk0k76n-hugo-8097s-projects.vercel.app](https://guachinho-site-6bwk0k76n-hugo-8097s-projects.vercel.app).
- Domínios confirmados no deployment: `gauchinhoconsorcios.com.br`, `www.gauchinhoconsorcios.com.br` e `admin.gauchinhoconsorcios.com.br`.
- Smoke HTTP read-only: `/login` do host Platform retornou `200`; `/platform/administradoras` sem sessão retornou `307` para `/login?next=/platform`, sem 500.

A auditoria focal de dados e o smoke visual autenticado continuam dependentes de uma sessão Platform disponível no navegador conectado. Eles não foram simulados nem substituídos por criação de conta, fixture ou alteração de senha.

## Estado final

A branch Supabase isolada `bwwgbmiwtrglbtxsdooi` foi mantida e está segura para exclusão somente após autorização explícita. Não será removida automaticamente.
