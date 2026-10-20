# Relatório de Implementação: Visibilidade de Grupos por Franquia e Reajuste em Lote

**Data:** 20/10/2026  
**Autor:** Antigravity AI Assistant  
**Escopo:** Catálogo Global SaaS (`/platform/grupos`), Catálogo Operacional ERP Franquia (`/erp/grupos`), Migration 323, Robô 3 Simulador.

---

## 1. Contexto e Motivação
O catálogo de grupos de consórcio continha grupos legados e históricos (163 grupos) que não estão mais abertos para novas vendas no simulador Racon, gerando poluição visual no ERP da franquia com mensagens de "0 cotas" e status "AGUARDANDO COTAS". Além disso, no painel global SaaS (`/platform/grupos`), os grupos extraídos necessitavam que seu status de valor e reajuste anual fosse automaticamente considerado atualizado no ano corrente, além de uma ferramenta em lote para selecionar múltiplos grupos e marcar como "Não enviar / Deixar ausente da franquia".

---

## 2. Entregas Realizadas

### 2.1. Banco de Dados (Migration 323)
- Criada a coluna `visivel_franquia boolean NOT NULL DEFAULT true` na tabela `public.grupos_consorcio`.
- Criado índice performático `idx_grupos_consorcio_visivel_franquia`.
- Criada a RPC `rpc_platform_set_grupos_visibilidade_franquia(p_grupo_ids uuid[], p_visivel boolean)` para alteração atômica em lote no catálogo global e sincronização na tabela N:N `empresa_grupos_config`.
- Criada a RPC `rpc_platform_marcar_reajuste_lote(p_grupo_ids uuid[], p_ano integer)` para homologação em lote de reajuste anual de valores.
- **Auto-reparo e Backfill Executado:**
  - Os 163 grupos sem cotas ativas foram definidos como `visivel_franquia = false`.
  - Os 28 grupos ativos com cotas extraídas do simulador foram definidos como `visivel_franquia = true`, `ano_ultimo_reajuste = 2026`, modalidades padrão vinculadas e `tipo_administradora_id` devidamente preenchido.
  - Resultado da auditoria de prontidão: **28 PRONTOS, 0 COM PENDÊNCIAS**.

### 2.2. Painel Operacional SaaS (`/platform/grupos`)
- **Seleção Múltipla em Lote:** Checkboxes em cada linha da tabela e checkbox master no cabeçalho.
- **Barra de Ação Flutuante/Fixa:** Quando há 1 ou mais grupos selecionados:
  - `[🚫 Não Enviar / Deixar Ausente da Franquia]`
  - `[✓ Liberar / Enviar para Franquia]`
  - `[⚡ Marcar Valor / Reajuste Atualizado]`
  - `[Desmarcar todos]`
- **Coluna de Status da Franquia:** Exibição clara de `✓ Enviado` (verde) ou `🚫 Ausente` (cinza escuro).
- **Abas de Filtragem:** Filtros rápidos por status de reajuste e visibilidade na franquia (`Todos`, `Enviados`, `Ausentes`).

### 2.3. ERP da Franquia (`/erp/grupos`)
- A listagem operacional da franquia agora filtra rigorosamente `visivel_franquia !== false`.
- Grupos marcados como ausentes pelo SaaS deixam de ser exibidos no ERP, eliminando a exibição de grupos desativados com "0 cotas".

### 2.4. Robô 3: Simulador Racon (`scripts/robo-simulador-service.mjs`)
- O robô agora garante na sincronização:
  - `visivel_franquia = true`
  - `ano_ultimo_reajuste = current_year`
  - `data_ultimo_reajuste = now()`
  - Vinculação de `tipo_administradora_id` (Imóvel / Automóvel)
  - Vinculação automática das 3 modalidades padrão de comissão (`INTEGRAL`, `REDUZIDA_ABAIXO_59`, `REDUZIDA_60_99`).

---

## 3. Homologação e Verificação
- Migration 323 aplicada via `npx supabase db push`.
- Auditoria de dados executada: 28 grupos prontos com cotas, 163 grupos ausentes isolados.
- Testes de integridade de tipos e build concluídos.
