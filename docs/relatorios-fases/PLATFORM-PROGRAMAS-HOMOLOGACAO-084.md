# Relatório de Correção — Platform Programas Homologação (Migration 084)

## 1. Causa Raiz
Na implementação da Migration 083 (`083_platform_administradoras_hub_catalogo.sql`), a função `rpc_platform_status_programa` realizava a validação do cronograma comparando a soma das etapas com o valor fixo `100` (`abs(sum(e.percentual_venda) - 100) > 0.0001`).

Essa validação era incorreta para as Regras Master da Franqueadora (como Racon Automóveis 3,5% e Imóvel 4,0%), onde cada etapa do cronograma é expressa diretamente como percentual sobre o valor vendido (e.g., 0,50% + 0,25% + ... = 3,50%). Ao tentar homologar regras perfeitamente fechadas no total da comissão, o sistema bloqueava com a mensagem genérica:
`"Todas as regras exigem Tipo, Modalidade e cronograma fechado em 100%"`

## 2. Correção Financeira e Canônica (Migration 084 Forward-Only)
A Migration `084_fix_homologacao_programas_catalogo.sql` foi criada de forma estritamente **FORWARD-ONLY**, preservando integralmente as migrations `001–083` aplicadas em Produção e todos os dados e snapshots históricos:

- **Critério de Validação:** A soma das etapas (`sum(e.percentual_venda)`) é comparada com o percentual total da própria regra (`r.percentual_total_comissao` ou `r.valor_fixo_total` caso a base de cálculo seja valor fixo).
- **Contemplação:** A soma considera todas as etapas vinculadas à regra, incluindo gatilhos de `PARCELA` e `CONTEMPLACAO` (e.g., 2,25% parcelas + 1,25% contemplação = 3,50%).
- **Mensagens Granulares:** A validação agora aponta especificamente qual regra está com pendência e o motivo exato (e.g. `Regra (Automóveis - Reduzida abaixo de 59%): cronograma soma 3.25%, mas comissão total é 3.50%`).
- **Salvaguardas de Versionamento:**
  - Versão em `RASCUNHO` pode ser editada diretamente sem gerar nova versão.
  - Tentativa de gerar nova versão a partir de `RASCUNHO` ou `SUBSTITUIDO` é bloqueada.
  - Versão `HOMOLOGADO` pode gerar nova versão (que nasce em `RASCUNHO` com cópia de todas as regras e cronogramas, enquanto a anterior passa a `SUBSTITUIDO`).

## 3. Melhorias de UX e Arquitetura Visual
1. **Agrupamento Estruturado:** A visualização agrupa por **PROGRAMA → VERSÃO → REGRAS INTERNAS**.
2. **Card Unificado da Versão:**
   - Cabeçalho com: Nome do Programa, Badge de Versão (`v1`, `v2`), Badge de Status (`HOMOLOGADO`, `RASCUNHO`, `SUBSTITUÍDA · HISTÓRICO`).
   - Metadados: Franqueadora, Comissão, Quantidade de Modalidades, Período de Vigência e Contador de Pendências.
3. **Ação Única de Homologação:**
   - Um botão principal `Homologar versão X` por programa.
   - Habilitado com cursor pointer e estilo esmeralda quando todas as regras estão válidas.
   - Desabilitado com cursor not-allowed e tooltip/banner explicativo quando houver pendências.
   - Feedback de sucesso explícito: `"Versão homologada com sucesso."`.
4. **Tabela de Regras Internas:**
   - Colunas: `Tipo | Modalidade | Comissão Total | Cronograma | Curva de Estorno | Estado da Validação`.
   - Estado de validação individual exibindo `✓ OK` ou o detalhe da pendência daquela modalidade.
5. **Ações Governamentais por Status:**
   - `RASCUNHO`: botões `Homologar`, `Editar regras e cronograma`, `Excluir rascunho`. Sem botão de "Nova versão".
   - `HOMOLOGADO`: botões `Criar nova versão` (com modal de confirmação), `Inativar`, `Ver regras e cronograma`.
   - `SUBSTITUIDO`: apenas consulta histórica via `Ver regras e cronograma`, sem ações destrutivas ou de homologação.
6. **Rota Platform-native:**
   - `/platform/administradoras/[id]/programas/[programaId]` exibe a visão detalhada com resumo executivo, status e tabela completa do cronograma de repasses com somatório conferido.

## 4. Matriz de Testes Automatizados (Vitest)
Executado em `src/lib/platform/administradoras-homologacao-084-contract.test.ts`:

| Teste | Cenário | Resultado |
|---|---|---|
| A | Automóveis Integral 3,5% (9 parcelas somando 3,50%) | **HOMOLOGA** (PASSOU) |
| B | Automóveis Reduzida 60–99 3,5% (somando 3,50%) | **HOMOLOGA** (PASSOU) |
| C | Automóveis Reduzida <59 3,5% (2,25% parcelas + 1,25% contemplação) | **HOMOLOGA** (PASSOU) |
| D | Imóvel Integral 4,0% | **HOMOLOGA** (PASSOU) |
| E | Regra 3,5% com cronograma somando 3,25% | **BLOQUEIA** (PASSOU) |
| F | Regra sem Tipo definido | **BLOQUEIA** (PASSOU) |
| G | Regra sem Modalidade definida | **BLOQUEIA** (PASSOU) |
| H | Ciclo completo de versionamento e UX contracts | **PASSOU** |

## 5. Gates Locais de Qualidade

| Gate | Comando | Status |
|---|---|---|
| 1. TypeScript | `npx tsc --noEmit` | **PASSOU** (0 erros) |
| 2. Testes focados | `npm test -- src/lib/platform/` | **PASSOU** (33/33 testes) |
| 3. Suíte completa | `npm test` | **PASSOU** (771 testes, 0 falhas) |
| 4. Lint do escopo | `npx eslint ...` (arquivos alterados) | **PASSOU** (0 erros/avisos) |
| 5. Build Next.js | `npm run build` | **PASSOU** (134 páginas otimizadas) |
| 6. Segurança | `npm audit --registry=https://registry.npmjs.org/` | **PASSOU** (0 vulnerabilidades) |
| 7. Git Diff Check | `git diff --check` | **PASSOU** (sem erros de whitespace/conflito) |
| 8. Migration Lint/Parser | Validação SQL da 084 | **PASSOU** |

## 6. Estado de Produção
- **Produção NÃO foi alterada** (permanece na migration 083).
- Branch isolada e worktree preparadas para homologação pelo proprietário.
