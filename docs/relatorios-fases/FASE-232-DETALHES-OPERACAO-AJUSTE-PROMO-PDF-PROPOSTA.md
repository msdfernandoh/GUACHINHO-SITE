# Relatório de Fase 232 — Detalhes da Operação, Ajuste Promocional de Fechamento e PDF Oficial da Proposta

> **Status:** Concluído com sucesso  
> **Data:** 15 de Setembro de 2026  
> **Escopo:** ERP Contratações · Formalização · Auditoria e Criptografia · PDF Proposta Unificado (Capa + 3 Folhas)

---

## 1. Visão Geral do Problema

Dois gargalos críticos na jornada de fechamento e formalização comercial foram identificados:

1. **Tela de Fechamento / Formalização no ERP (`/erp/contratacoes/[id]`):**
   - Os operadores não visualizavam os detalhes cruciais da contratação: se havia seguro de vida/prestamista contratado, taxa de administração do grupo, fundo de reserva e valores das parcelas.
   - Não era possível realizar ajustes finais de taxa e parcelas para condições promocionais de fechamento (descontos de campanhas, aprovação de diretoria, feirões).
2. **Modelo do PDF da Proposta:**
   - Ao baixar o PDF da proposta, o sistema gerava ocasionalmente o documento no modelo legado (antigo template escuro `#18181b`, já desativado).
   - O documento oficial e vigente é o modelo moderno em 4 folhas (**Capa + 3 Folhas**), exatamente como o exibido na tela de grupos e simulação consolidada.

---

## 2. Diagnóstico e Arquitetura

### 2.1 Detalhes Operacionais e Ajustes Promocionais no ERP
- As colunas `taxa_administrativa_percentual`, `fundo_reserva_percentual`, `seguro_habilitado`, `seguro_percentual` e `seguro_valor` já estavam presentes na tabela `grupos_consorcio`.
- Na tabela `contratacoes_online`, o snapshot de simulação (`dados_simulacao`) e a coluna `parcela_estimada` representam a base da contratação.
- A função transacional `rpc_converter_contratacao_venda_multicotas` lê `parcela_estimada` para criar a venda e as cotas definitivas.
- Para manter a **imutabilidade e rastreabilidade criptográfica**, quando um operador do ERP altera a taxa ou parcela para uma condição comercial promocional autorizada:
  1. A taxa e parcela ajustadas são gravadas no objeto `dados_simulacao.ajuste_promocional`.
  2. O valor da parcela principal é atualizado em `contratacoes_online.parcela_estimada` e `dados_simulacao.valor_parcela`.
  3. O hash criptográfico `snapshot_calculo.hash_sha256` é recalculado via `calcularHashSnapshotGrupos(novoDadosSimulacao)`. Isso assegura que futuras validações de `assertSnapshotCalculoGruposIntegro` continuem 100% íntegras e válidas.
  4. Um evento `AJUSTE_PROMOCIONAL_APLICADO` é gravado na tabela append-only `contratacoes_formalizacao_historico`.

### 2.2 PDF Oficial em 4 Folhas (Capa + 3 Folhas)
- O template moderno em `src/lib/proposta/pdf/proposta-pdf-document.tsx` é composto por:
  - **Folha 1 (Capa):** `CapaPadrao` ou `CapaCampanha`.
  - **Folha 2 (Resumo Comercial):** `FolhaResumo` com dados do cliente, consultor, resumo financeiro, prazos e lances.
  - **Folha 3 (Detalhamento do Grupo/Segmento):** `SegBlock` com cotas, prazos, taxas, seguros e fluxo financeiro.
  - **Folha 4 (Encerramento Institucional):** `FolhaEncerramento` com comparativo financeiro, regras do consórcio e contatos.
- Algumas propostas geradas sem `simulacao_grupo_id` ou sem array de segmentos carregavam `data.segmentos = []`, o que levava ao fallback indesejado para o `LegacyDocument`.
- **Solução:** Em `load-pdf-data.ts`, implementou-se a montagem obrigatória e padronizada de segmentos para **todas** as propostas. Além disso, em `proposta-pdf-document.tsx`, inseriu-se a função `fallbackSegmentoFromData(data)` para que, mesmo diante de propostas legadas puras, o documento sintetize o segmento e use **sempre o modelo oficial moderno em 4 folhas**. O modelo legado escuro foi desativado em definitivo.

---

## 3. Implementação Realizada

### 3.1 Unificação do PDF Oficial
Arquivos modificados:
- [`gauchinho-app/src/lib/proposta/load-pdf-data.ts`](file:///c:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/lib/proposta/load-pdf-data.ts)
- [`gauchinho-app/src/lib/proposta/pdf/proposta-pdf-document.tsx`](file:///c:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/lib/proposta/pdf/proposta-pdf-document.tsx)

1. `load-pdf-data.ts` agora constrói itens de grupo e executa `construirSegmentos` para qualquer proposta, quer possua grupo cadastrado, seleções múltiplas ou grupo sintético.
2. `proposta-pdf-document.tsx` adicionou `fallbackSegmentoFromData(data)` garantindo que `segmentos.length > 0` em tempo de renderização do `@react-pdf/renderer`.
3. Todas as 25 rotinas de teste em `src/lib/proposta` foram validadas e aprovadas.

### 3.2 Consulta de Detalhes da Operação no ERP
Arquivo modificado:
- [`gauchinho-app/src/app/erp/contratacoes/[id]/page.tsx`](file:///c:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/app/erp/contratacoes/%5Bid%5D/page.tsx)

- Estendida a consulta em `grupos_consorcio` para selecionar:
  `taxa_administrativa_percentual, fundo_reserva_percentual, seguro_habilitado, seguro_percentual, seguro_valor, seguro_pos_contemplacao`.
- Passado `dadosSimulacao={c.dados_simulacao}` para o componente `FormalizacaoVendaForm`.

### 3.3 Formulário de Formalização e Fechamento
Arquivo modificado:
- [`gauchinho-app/src/components/erp/contratacoes/formalizacao-venda-form.tsx`](file:///c:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/components/erp/contratacoes/formalizacao-venda-form.tsx)

1. **Cards de Detalhes da Operação:**
   - **Seguro Prestamista:** Exibe status contratado/isento com valor mensal embutido ou alíquota percentual.
   - **Taxa de Administração:** Exibe percentual do grupo, com indicação tachada da taxa base se houver ajuste promocional ativo.
   - **Fundo de Reserva:** Percentual de reserva do grupo.
   - **Valor da Parcela:** Parcela acordada / mensal, indicando a parcela base e a promocional quando ajustada.
2. **Painel Retrátil de Ajuste Comercial / Promoção:**
   - Checkbox "Aplicar Ajuste Comercial / Promoção de Fechamento".
   - Inputs para Taxa de Adm. Ajustada (%), Parcela Ajustada (R$) e Motivo / Campanha Promocional.
   - Hidden inputs integrados ao formulário de envio.
3. **Resumo da Venda:**
   - Badge explicativo com valores aplicados e justificativa comercial.

### 3.4 Server Action: Aplicação do Ajuste Promocional
Arquivo modificado:
- [`gauchinho-app/src/app/erp/contratacoes/actions.ts`](file:///c:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/app/erp/contratacoes/actions.ts)

- Em `formalizarContratacaoAction`:
  1. Extrai `taxa_administracao_ajustada`, `valor_parcela_ajustado` e `motivo_ajuste_promocional`.
  2. Valida valores informados.
  3. Atualiza `contratacoes_online.parcela_estimada` e injeta `ajuste_promocional` em `dados_simulacao`.
  4. Recalcula o hash SHA-256 via `calcularHashSnapshotGrupos(novoDadosSimulacao)`.
  5. Insere registro de auditoria na tabela `contratacoes_formalizacao_historico` com o evento `AJUSTE_PROMOCIONAL_APLICADO`.
  6. Dispara `rpc_preparar_formalizacao_contratacao` e `converterContratacaoEmVenda`.

---

## 4. Testes e Validação

- **Testes Unitários e de Contrato:**
  - [`src/lib/erp/contratacoes-ajuste-promo-detalhes.test.ts`](file:///c:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/lib/erp/contratacoes-ajuste-promo-detalhes.test.ts): 5 testes cobrindo renderização, inputs de ajuste promocional, auditoria, recomputação de hash e unificação do PDF oficial.
  - [`src/lib/erp/contratacoes-*`](file:///c:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/lib/erp/): 6 arquivos de teste, **22 testes aprovados (100% PASS)**.
  - [`src/lib/proposta/*`](file:///c:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/lib/proposta/): 6 arquivos de teste, **25 testes aprovados (100% PASS)**.
- **Multi-Tenancy e Segurança:**
  - Estrita verificação de `empresa_id` em todas as consultas e mutations.
  - O banco de dados Supabase e os dados existentes da **Gauchinho Consórcios** permanecem 100% íntegros e preservados.
