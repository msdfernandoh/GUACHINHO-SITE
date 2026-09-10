# Fase 216 — Reajuste Anual Operacional de Grupos (Platform SaaS)

## Contexto e Objetivo
Esta fase operacionaliza a regra canônica de reajuste anual dos grupos (introduzida na Fase 200) na listagem e na gestão operacional do SaaS Platform (`admin.gauchinhoconsorcios.com.br` / `/platform/grupos`).

O objetivo foi atender à necessidade de:
1. Identificar automaticamente quando o grupo completou ao menos 1 ano desde a 1ª assembleia e o mês de aniversário chegou no ano corrente;
2. Exibir na listagem de grupos a tag de atenção `⚠ Reajuste: Mês de [Mês]` alertando a necessidade de reajuste;
3. Disponibilizar o botão **Aplicar Reajuste**, com suporte a:
   - **VARIÁVEL**: permite digitar a porcentagem de reajuste OU o novo valor de qualquer uma das cotas, calculando automaticamente o percentual e propagando para todas as demais cotas do grupo em tempo real;
   - **FIXO**: aplica o percentual já configurado contratualmente no grupo (`reajuste_anual_percentual% fixo`) a todas as cotas;
   - Atualiza os valores nos sites públicos e no ERP de imediato;
4. Disponibilizar o botão **Já Reajustado** para dispensar a tag de atenção sem alterar os valores (para casos em que o valor já esteja correto ou não haja necessidade de reajuste no ciclo anual).

---

## Modificações Realizadas

### 1. Banco de Dados (PostgreSQL / Supabase)
- **Migration `216_grupos_reajuste_anual_operacional.sql`**:
  - Adicionadas colunas `ano_ultimo_reajuste integer` e `data_ultimo_reajuste timestamptz` na tabela `public.grupos_consorcio`.
  - Criada RPC `public.rpc_marcar_grupo_reajustado(p_grupo_id uuid, p_ano integer)` protegida por `is_platform_superadmin()`.
  - Atualizada RPC `public.rpc_platform_reajustar_creditos_grupo` para salvar atomicamente `ano_ultimo_reajuste` e `data_ultimo_reajuste` juntamente com `credito_reajustado_ate_meses`.

### 2. Funções Canônicas de Negócio (`reajuste-anual.ts`)
- `obterStatusReajusteAnual(grupo, dataReferencia)`:
  - Analisa a data da 1ª assembleia e o ano/mês corrente.
  - Verifica se o grupo completou $\ge 12$ meses (`deuUmAno`).
  - Verifica se no ano corrente o mês de aniversário já chegou (`aniversarioAtingidoNoAno`).
  - Compara com `ano_ultimo_reajuste`.
  - Retorna `precisaReajuste`, `jaReajustadoAnoAtual`, `nomeMesAniversario`, `tagTexto` e `tagTipo`.
- `calcularNovoCreditoPorPercentual(valorAtual, percentual)`: cálculo preciso com 2 casas decimais.
- `calcularPercentualPorVariacao(valorAtual, novoValor)`: calcula a variação percentual resultante da alteração de uma cota.
- `calcularPropagacaoCotaBase(cotas, cotaEditadaId, novoValor)`: propaga a variação percentual de uma cota para todas as demais cotas do grupo.

### 3. Server Actions (`grupos-actions.ts`)
- `marcarGrupoJaReajustadoPlatformAction(grupoId, ano)`: chama a RPC `rpc_marcar_grupo_reajustado`, revalida caminhos `/platform/grupos`, `/platform/grupos/[id]`, `/admin/grupos`, `/erp/grupos` e `/grupos`.
- `reajustarCreditosGrupoPlatformAction`: atualizada para aceitar o ano do reajuste e persistir `ano_ultimo_reajuste`.

### 4. Interface do Usuário (Platform SaaS)
- **`GrupoReajusteAnualModal`**:
  - Modal intuitivo com separação visual clara entre FIXO e VARIÁVEL.
  - No modo VARIÁVEL: permite digitar o % ou digitar o valor de qualquer cota, propagando a taxa automaticamente.
  - No modo FIXO: exibe o percentual fixo contratual cadastrado no grupo e lista todas as cotas recalculadas para confirmação.
- **`GruposListPlatformClient`**:
  - Integrado em `/platform/grupos`.
  - Coluna **Reajuste Anual**: tag `⚠ Reajuste: Mês de [Mês]` com destaque visual em âmbar e animação de pulso quando pendente; `✓ Reajustado ([Ano])` quando concluído; e mês de aniversário futuro quando não atingido.
  - Coluna **Ações**: botões "Abrir", "Aplicar Reajuste" e "Já Reajustado".
  - Abas superiores para filtragem rápida: "Todos", "⚠ Reajuste Pendente" e "✓ Já Reajustados".
- **`GrupoOperationalWorkspace`**:
  - Cabeçalho do grupo em `/platform/grupos/[id]` atualizado com os botões "Aplicar Reajuste" e "Já Reajustado".

---

## Verificação e Testes

1. **Testes Unitários (`reajuste-anual-operacional.test.ts`)**:
   - 10 testes cobrindo todas as variações temporais (sem assembleia, < 1 ano, aniversário no futuro, aniversário no passado com tag de atenção, grupo marcado como já reajustado, cálculos matemáticos e propagação de cota).
2. **Testes de Contrato (`reajuste-anual-216-contract.test.ts` e `reajuste-anual-200-contract.test.ts`)**:
   - 7 testes garantindo a preservação do modelo relacional, triggers, RPCs, ações de servidor e catálogo.
3. **Build de Produção**:
   - Executado `npm run build` com sucesso: 152 rotas compiladas e geradas sem nenhum erro de TypeScript.
