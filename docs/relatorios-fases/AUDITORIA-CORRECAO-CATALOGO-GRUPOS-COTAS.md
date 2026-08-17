# Auditoria e correção — Catálogo, Grupos e Cotas

## Estado anterior e erro conceitual

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

## Testes executados

- contrato Vitest da 077: 3 PASS;
- suíte completa: 719 PASS / 37 SKIP em 135 arquivos;
- TypeScript (`tsc --noEmit`): PASS;
- lint do escopo: PASS;
- build Next.js: PASS, 127 rotas, incluindo `/platform/grupos/[id]`;
- `npm audit --omit=dev`: 0 vulnerabilidades;
- `git diff --check`: PASS (somente avisos de normalização LF/CRLF).

## Preview e pendências

A aplicação da 077 no Supabase isolado, os testes funcionais reais com três modalidades, screenshots autenticados e um novo Vercel Preview permanecem pendentes. Nenhuma tentativa de aplicação em Production foi realizada ou autorizada.
