# Auditoria e correção — Catálogo, Grupos e Cotas

## Estado canônico e erro conceitual

Base Git da entrega: `origin/main@323147c`. Production foi auditada somente para
leitura no projeto `eaeuoynprurmmulzhydt` e registrava `001–079`, sendo `077`
`erp_importacao_socios_permissoes`, `078`
`fix_076_fluxo_administradora_operacional` e `079`
`financeiro_contas_pagar_governanca`. A antiga candidata de catálogo 079 colidiu
com essa migration financeira e foi renumerada para 080 sem alterar as oficiais.

A migration 076 criou corretamente `administradora_tipos`, `administradora_modalidades_comissao` e regras por Tipo/Modalidade, mas adicionou uma única `modalidade_comissao_id` ao Grupo. A UI e o motor V2 passaram a inferir dela a modalidade da venda. Isso não representa Grupos que oferecem múltiplas formas de pagamento.

`grupos_cotas` já representa produtos/opções de crédito; `cotas_definitivas` representa a cota real do cliente. A distinção foi preservada.

## Matriz dos campos legados

| Campo | Semântica auditada | Destino |
|---|---|---|
| `valor_parcela` | parcela efetiva legada | compatibilidade histórica |
| `parcela_integral` | parcela integral sem seguro | compatibilidade/simulação legada |
| `parcela_reduzida` | uma parcela reduzida legada | não identifica faixa canônica |
| `parcela_sem_seguro` | parcela-base escolhida pelo legado | dimensão seguro legada |
| `parcela_com_seguro` | parcela-base + seguro mensal | seguro; não modalidade |
| `grupos_consorcio.modalidade_comissao_id` | modalidade singular introduzida na 076 | legado; backfill apenas como disponibilidade conhecida e pendente de revisão |

## Modelo e migration

A migration `080_catalogo_grupos_modalidades_produtos.sql` cria:

- `grupos_modalidades_disponiveis`, relação N:N com inativação;
- `grupo_cota_modalidade_valores`, valor oficial dinâmico por produto/modalidade;
- campos explícitos e snapshot da modalidade/parcela na venda;
- validações de pertencimento à Administradora e ao Grupo;
- RLS com escrita exclusiva de Platform Superadmin;
- view de prontidão dos produtos.

Nenhuma coluna/tabela antiga é removida. Nenhuma venda, cota definitiva, previsão, pagamento ou comissão histórica é recalculada. O backfill só transforma a modalidade singular conhecida em uma disponibilidade marcada para revisão; não interpreta colunas de parcela ambíguas.

## Aplicação e UX

`/platform/grupos/[id]` concentra seleção múltipla de modalidades, criação/edição/inativação de produtos, valores por modalidade e validação de regra homologada. `/platform/produtos-comerciais` é uma visão global que aponta para esse editor único.

## Cálculo

Existe cálculo legado baseado em saldo, prazo, taxa, fundo e seguro, mas não há evidência suficiente de que reproduza todas as modalidades oficiais de todas as Administradoras. A fase usa valores oficiais manuais e não inventa fórmula.

## Supabase isolado e reconstrução do histórico

- branch: `codex-catalogo-grupos-modalidades-079`;
- `project_ref`: `valcreavxhpuqmmbwaqo`;
- custo autorizado: US$ 0,01344/h enquanto ativa;
- estado inicial real: migrations `001–047`, zero grupos e zero produtos;
- primeira tentativa da 048: revertida pela asserção oficial
  `19 grupos / 178 cotas`; nenhuma alteração parcial persistiu;
- a 048 foi auditada integralmente e não foi editada. Ela exige Racon canônica
  ativa, 19 grupos com `administradora_id NULL`, aliases textuais 16×`RACON` e
  3×`Racon`, zero aliases desconhecidos e 178 produtos relacionados por FK;
- fixture `supabase/tests/fixtures_catalogo_replay_048.sql`: 100% sintética,
  determinística e sem pessoas/CPF/CNPJ/telefone/e-mail. Distribui 10 produtos
  nos grupos 1–7 e 9 produtos nos grupos 8–19, totalizando 19/178;
- replay oficial, sem alterar migrations históricas: 048, 049, …, 079;
- gate antes da 080: `min=001`, `max=079`, `total=79`, `missing=''`, nomes
  077/078/079 iguais aos oficiais;
- aplicação da 080: concluída somente em `valcreavxhpuqmmbwaqo` e registrada
  como `catalogo_grupos_modalidades_produtos`.

## E2E decisivo e persistência

Fixture: Racon, Tipo Automóveis, Grupo sintético 5488 e Produto sintético
Crédito R$ 100.000. O campo singular legado do Grupo ficou propositalmente em
Integral para provar que não governa as vendas novas.

| Venda | Modalidade explícita/snapshot | Parcela congelada | Regra independente | Contemplação |
|---|---|---:|---|---|
| A | `INTEGRAL` | R$ 2.500,00 | `a1ea102a-9cb4-4783-9291-cdc1a407030f` | não aplicável |
| B | `REDUZIDA_60_99` | R$ 1.750,00 | `a9a26b11-7afd-44fd-be9d-23131c1bfcc6` | não aplicável |
| C | `REDUZIDA_ABAIXO_59` | R$ 1.250,00 | `b4345a55-cb8f-4e8f-906c-ea8c329639f9` | previsão `CONTEMPLACAO` criada |

O script `supabase/tests/catalogo_modalidades_080_e2e.sql` comprovou também:

- venda sem modalidade explícita bloqueada, sem fallback do singular legado;
- produto sem valor oficial na modalidade bloqueado como configuração pendente;
- Grupo sem modalidade disponível bloqueado;
- regra não homologada bloqueada pelo motor canônico;
- funções V2 reescritas leem o snapshot (`grupo_fallback_pos=0`);
- produto utilizado não pode ser excluído; o E2E encontrou e corrigiu antes
  da homologação uma referência inválida a `propostas.grupo_cota_id`, usando a
  relação real `simulacoes_grupos_itens.grupo_cota_id`;
- seguro permanece dimensão separada;
- fato legado sintético permaneceu idêntico e com zero previsões/recalculo.

Após reload independente: 3 modalidades ativas, valores `2500/1750/1250`,
produto não utilizado editado para `123457`, prontidão `3/3=true`, 3 vendas
persistidas, venda legada intacta e zero previsões legadas.

## Testes executados

- contrato Vitest da 080: 4 PASS;
- suíte completa: 740 PASS / 37 SKIP em 142 arquivos;
- TypeScript (`tsc --noEmit`): PASS;
- lint do escopo: PASS;
- build Next.js 16 com Webpack: PASS, 131 páginas, incluindo
  `/platform/grupos/[id]`; o Turbopack não aceita o junction de dependências
  compartilhadas do worktree, limitação ambiental anterior à compilação;
- `npm audit --omit=dev`: 0 vulnerabilidades;
- `git diff --check`: PASS (somente avisos de normalização LF/CRLF).

## Preview e pendências

A 080 foi aplicada somente no Supabase isolado `valcreavxhpuqmmbwaqo` e o E2E
decisivo passou. Faltam somente commit/push, Vercel Preview e screenshots
autenticados. Nenhuma promoção para Production foi feita; nenhum backfill ou
recálculo histórico foi executado em Production.
