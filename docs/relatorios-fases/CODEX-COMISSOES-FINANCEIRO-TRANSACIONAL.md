# CODEX — COMISSÕES E FINANCEIRO TRANSACIONAL

**Data:** 11/08/2026  
**Branch:** `codex/comissoes-financeiro-transacional`  
**Base:** `e3bf8ac` (`main`)  
**Escopo:** motor canônico de comissão, conversão comercial atômica, recebimentos, pagamentos, compensações, cancelamentos e estornos.  
**Estado:** implementação isolada pronta para auditoria final; sem merge e sem aplicação `060+` em Produção.

## 1. Resultado

Foram implementadas quatro migrations forward-only (`060–063`) e substituídos os fluxos críticos de runtime por RPCs PostgreSQL atômicos. O conjunto foi validado com PostgreSQL real em branch Supabase efêmera clonada de Produção, teste transacional com `ROLLBACK`, duas sessões concorrentes, suíte local, TypeScript, ESLint do escopo e build Next.js.

Produção permaneceu inalterada. A verificação final no projeto principal `eaeuoynprurmmulzhydt` retornou migration máxima `059` e ausência de `public.operacoes_idempotentes`, marcador introduzido pela `060`.

Estados reconciliados na parada:

- `PRODUCTION_ATUAL`: Vercel `dpl_A7nvWWm78gpT1CfKrCa52TKeb4JM`, target `production`, `READY`; Supabase principal em `059`;
- `MAIN_ATUAL`: `e3bf8ac9a2884689aafde731bc3eac82f85c170d`;
- `AUDIT_BRANCH_CODEX`: `8d3c2168c702f6ca5ad510d077d5486b13f4c2ce`;
- `CODEX_PREVIEW`: `dpl_5MGJBEUkrCBXqDnJkL619x82dNqR`, target `preview`, `READY`.

## 2. Decisões canônicas implementadas

- nenhuma regra é selecionada por percentual/default implícito;
- regras legadas preservadas recebem `configuracao_homologada=false` e não são selecionadas automaticamente;
- franquia e beneficiário possuem motores independentes;
- programa homologado exige administradora explícita;
- regra válida é escolhida pela data da venda e compatibilidade com modalidade, opção de cota e plano/condição;
- empate na mesma precedência falha; ausência de regra também falha;
- precedência do beneficiário: participante específico > organização específica > genérica;
- participante e organização podem coexistir na venda, mas apenas uma regra/um beneficiário é materializado por etapa; não existe pagamento duplo implícito;
- bases aceitas: percentual sobre crédito e valor fixo;
- cronogramas são configuráveis, validados em 100% ou soma fixa exata, sem períodos hardcoded;
- snapshots guardam regra, programa, versão, vigência, seletor, cronograma e etapa;
- o último centavo é atribuído deterministicamente à última etapa;
- toda aritmética monetária crítica ocorre em `numeric` no PostgreSQL; runtime transmite strings decimais;
- participante só se torna elegível proporcionalmente ao valor da etapa de franquia realmente liquidado;
- pagamento acima da elegibilidade falha e pagamento líquido nunca é negativo;
- cancelamento depois de pagamento cria compensação futura, sem reescrever o pagamento histórico;
- recebimentos, pagamentos, compensações, movimentos compensatórios, estornos e chaves idempotentes são append-only.

## 3. Migrations

### 060 — modelo canônico

Remove defaults comerciais das regras, adiciona seletores, vigência/versão do participante, valor fixo, homologação explícita e saldos das previsões. Cria:

- `operacoes_idempotentes`;
- `financeiro_compensacao_movimentos`;
- `financeiro_estornos`;
- constraints de base, valor, cronograma, beneficiário e saldos;
- unicidade contratação/tenant e venda/cota.

### 061 — motor e conversão comercial

Cria validação de cronogramas, guards de configuração/versionamento, `rpc_gerar_previsoes_comissao` e `rpc_converter_contratacao_venda`. A conversão bloqueia a contratação, valida tenant/concessão/grupo/opção, cria venda/cota, finaliza contratação/lead e gera previsões na mesma transação.

### 062 — financeiro transacional

Cria `rpc_registrar_recebimento`, `rpc_registrar_pagamento` e `rpc_gerar_compensacao`. Os RPCs validam soma exata dos itens, tenant, administradora, competência, beneficiário único, teto elegível e idempotência; locks seguem ordem estável.

### 063 — cancelamentos, estornos e append-only

Cria `rpc_cancelar_venda_comissoes`, `rpc_estornar_recebimento`, `rpc_estornar_pagamento`, integridade dos novos históricos e `financeiro_compensacoes_saldos`.

Durante o teste real foi identificado e corrigido um caso de ciclo inverso: uma compensação gerada por sobrepagamento após estorno de recebimento precisava ser neutralizada se o pagamento causador fosse posteriormente estornado. A solução adiciona o movimento append-only `cancelamento`; se o crédito já foi consumido por pagamento posterior, o estorno é bloqueado até que os fatos posteriores sejam revertidos na ordem correta.

Também foi ajustada a origem do caixa inverso para referenciar o recebimento/pagamento original, conforme o trigger de integridade da migration `059`; o detalhe do evento continua preservado em `financeiro_estornos`.

## 4. Runtime

- `comissoes-service.ts`: geração delegada a um único RPC;
- `vendas-service.ts`: conversão delegada ao RPC atômico, removendo fallback hardcoded e escritas parciais;
- `financeiro-service.ts`: recebimento, pagamento, compensação, cancelamento e estornos via RPC;
- valores monetários de entrada são strings decimais (`ValorMonetario`);
- resumo consulta saldos derivados da view append-only, não o campo legado mutável;
- testes live continuam protegidos por `RUN_LIVE_PRODUCTION_AUDIT`.

## 5. Homologação Supabase isolada

Ambiente final:

- branch: `codex-comissoes-financeiro-060-v2`;
- project ref efêmero: `tbyuietwzedrkydtjzhd`;
- parent: `eaeuoynprurmmulzhydt`;
- clone de dados: sim;
- migrations `060–063`: aplicadas com sucesso somente nesse ambiente.

O teste reproduzível `supabase/tests/comissoes_financeiro_transacional_060_063.sql` executou e fez `ROLLBACK`. Cobertura comprovada:

- base fixa e percentual;
- regra específica e genérica;
- vigência, modalidade, administradora e ambiguidade;
- três etapas e distribuição do último centavo;
- snapshots e precedência;
- conversão contratação→venda→cota→previsões idempotente;
- recebimento parcial e elegibilidade proporcional;
- bloqueio de pagamento acima do elegível;
- pagamento totalmente compensado com líquido zero e sem saída de caixa;
- estorno de recebimento, estorno de pagamento e evento inverso da compensação;
- cancelamento após pagamento;
- tentativa cross-tenant bloqueada;
- `UPDATE` de histórico financeiro bloqueado.

Após o rollback, a fixture `TESTE CODEX 060-063` teve resíduo zero.

Teste concorrente real, em duas sessões simultâneas:

| Resultado | Quantidade/valor |
|---|---:|
| previsões de franquia | 1 |
| previsões de participante | 1 |
| recebimentos | 1 |
| valor liquidado | 10,00 |

Isso comprova que advisory locks + tabela idempotente impediram duplicação sob corrida. A fixture concorrente ficou restrita à branch efêmera, que deve ser excluída após o Preview/auditoria desta rodada.

## 6. Gates

- `npm test`: **660 PASS / 37 SKIP**, 0 falhas, 113 arquivos pass e 9 skip;
- `npx tsc --noEmit`: PASS;
- ESLint somente nos sete arquivos TypeScript alterados/adicionados: PASS;
- `npm run build`: PASS, Next.js 16.3.0, 119 páginas;
- lint global: baseline preexistente em **52 erros / 77 warnings**; erros fora do escopo desta rodada;
- teste SQL transacional: PASS/ROLLBACK;
- teste concorrente em duas sessões: PASS;
- Produção: migration máxima `059`, marcador `060` ausente.

## 7. Regras legadas 4% / 1,5%

As regras existentes foram preservadas, sem exclusão e sem ativação automática. Como o programa legado não possui administradora explícita, elas não satisfazem o contrato canônico e permanecem `configuracao_homologada=false` após a migration `060`.

Recomendação para uma futura rodada autorizada: configurar novos programas/regras canônicos com administradora, seletores, vigência, versão e cronograma homologados; só depois decidir sobre inativação controlada das regras legadas. Esta rodada não inventou percentuais nem transformou 4%/1,5% em defaults.

## 8. Exclusões de escopo

Não foram alterados sorteios, `grupos_sorteios_loteria_public_read`, APIs/runtime de sorteios, Racon/Sorriso, auditoria central, storage, performance ou FKs/retenção. A observação documental de autoria de sorteios não virou requisito ou tarefa.

## 9. Preview e parada

Preview Codex:

- URL: `https://guachinho-site-ef3vbdo9v-hugo-8097s-projects.vercel.app`;
- Deployment ID: `dpl_5MGJBEUkrCBXqDnJkL619x82dNqR`;
- estado: `READY`;
- target: Preview, sem promoção/alias de Produção;
- banco do build/runtime: branch Supabase efêmera `tbyuietwzedrkydtjzhd`;
- acesso externo: protegido pelo SSO da Vercel;
- smoke interno: `robots.txt` servido, `/api/public/indices-financeiros` retornou `ok=true` e `/api/admin/gestao/dashboard` anônima retornou `Não autenticado`.

Não executar merge, não aplicar `060–063` no projeto Supabase principal e não promover Preview para Produção sem autorização expressa do proprietário. O próximo passo permitido é apenas a auditoria final desta branch/Preview.
