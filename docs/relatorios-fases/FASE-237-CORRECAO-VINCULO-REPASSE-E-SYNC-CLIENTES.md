# FASE 237 — Correção do Vínculo de Recebimento de Repasse & Sincronização de Nome de Cliente

**Data:** 17/09/2026  
**Status:** CONCLUÍDO E HOMOLOGADO EM PRODUÇÃO  
**Migration:** `supabase/migrations/225_repasse_correcao_vinculo_duplicado_e_sync_cliente.sql`  

---

## 1. Contexto e Problema Identificado

Ao tentar conciliar um recebimento de repasse no ERP (`/erp/repasse-franquia`), o usuário relatou:
> *"NÃO CONSIGO VINCULAR UM RECEBIMENTO A UM CLIENTE PORQUE NO INCIO ELE ESTA CADASTRADO COM O NOME ERRADO POREM FOI ARRUMADO MAS LOCALIZA MAS NAO PERMITE VINCULAR. TESTE O BOTAO VINCULO E ANALISE E ARRUME O ERRO"*

### Análise e Diagnóstico Técnico

1. **Erro de Check Constraint na Baixa Duplicada:**
   - Ao acionar a ação de vínculo manual (`vincularItemRepasseManualAction`), o sistema executava a RPC `rpc_corrigir_vinculo_item_repasse`, que definia `status_conciliacao = 'VINCULADO_MANUAL'`.
   - Um trigger remanescente da Migration 186 (`trg_repasse_item_baixa_automatica`) disparava `repasse_baixar_itens_vinculados`, inserindo a primeira baixa de R$ 636,00 em `financeiro_recebimento_itens`.
   - Em seguida, a função canônica da Fase 203 (`sincronizar_item_repasse_canonico_203`) inseria outra baixa de R$ 636,00.
   - O recálculo somava R$ 1.272,00 para uma cota cujo `valor_previsto` era de R$ 636,00, estourando a constraint:
     ```sql
     new row for relation "comissao_previsoes_franquia" violates check constraint "comissao_previsao_franquia_saldos_check" (valor_liquidado <= valor_previsto)
     ```

2. **Divergência de Nome do Cliente entre Cadastro e Venda:**
   - O cliente `JANSER CARMOS AMARAL` havia sido cadastrado inicialmente na importação como `"JANSER +55 84 98667-1747"`.
   - O usuário corrigiu os dados em `/erp/clientes/97ca2464-955a-43ba-81b4-9c69a78f616a`.
   - Porém, a tabela `vendas` armazenava uma coluna desnormalizada `cliente_nome` que não era sincronizada ao editar o cliente.
   - Isso gerava um falso alerta persistente no relatório de repasse: *"Nome do cliente diverge do cadastro do sistema"*.

---

## 2. Alterações Implementadas

### Banco de Dados (Migration 225)
1. **Desativação de Trigger Duplicado:**
   - `DROP TRIGGER IF EXISTS trg_repasse_item_baixa_automatica ON public.erp_repasse_importacao_itens;`
   - Ajustada a função `repasse_baixa_automatica_trigger` para atuar exclusivamente a nível de importação, preservando a atomicidade das baixas por item na RPC canônica 203.
2. **Defesa Rigorosa contra Estouro de Saldo:**
   - Em `recalcular_liquidacao_previsao_repasse_203`, aplicado `v_liquidado := round(least(v_liquidado, v_previsao.valor_previsto), 2);` garantindo que nenhuma inconsistência viole a constraint.
3. **Idempotência Reforçada em `sincronizar_item_repasse_canonico_203`:**
   - Checagem prévia de lançamentos existentes em `financeiro_recebimento_itens` para o par `(recebimento_id, previsao_franquia_id)`, impedindo duplicações de baixa.
4. **Limpeza Automática de Alertas na RPC:**
   - `rpc_corrigir_vinculo_item_repasse` agora limpa explicitamente `alertas = '[]'::jsonb` ao confirmar o vínculo manual.
5. **Sincronização em Tempo Real `clientes` → `vendas`:**
   - Criado trigger `trg_sync_cliente_para_vendas` em `public.clientes` para propagar `nome`, `cpf_cnpj`, `telefone` e `email` para `vendas`.
6. **Backfill Retroativo:**
   - Executada sincronização de todas as vendas vinculadas a clientes existentes.
   - Limpeza de alertas obsoletos de divergência de nome nas linhas do cliente Janser.
7. **View Canônica Atualizada:**
   - `erp_repasse_item_conciliacao_canonica` enriquecida com `LEFT JOIN clientes` prioritário para exibição do nome canônico do titular.

### Frontend e Backend Next.js
1. **`src/app/erp/clientes/actions.ts`:**
   - `saveClienteAction` atualiza explicitamente `vendas` e revalida `/erp/vendas`, `/erp/repasse-franquia` e `/erp/comissoes`.
2. **`src/components/erp/erp-operational-pages.tsx`:**
   - Consulta de previsões enriquecida para buscar `venda:vendas(cliente_nome,cliente:clientes(nome))` e mapear `cliente?.nome || venda?.cliente_nome`.
3. **`src/components/erp/repasse-pdf-conciliacao.tsx`:**
   - `SearchablePrevisaoSelect` transformado em componente controlado com `value={selectedId}`, sincronização automática com `defaultValue`, busca ampliada (nome, cota, grupo, competência) e seleção rápida.

---

## 3. Verificação e Homologação

1. **Aplicação da Migration:**
   - `supabase db push --include-all` aplicado com sucesso no banco remoto `eaeuoynprurmmulzhydt`.
2. **Execução de Vínculo em Produção:**
   - Linha 5 (Cota 0707, item `34d5b98c-b189-4365-92ac-be78f8015766`) vinculada com sucesso à previsão `8ad69d03-8a18-4d48-825e-7339ee5653f8`.
     - Status: `VINCULADO_MANUAL`
     - Valor liquidado: R$ 636,00 (exato, sem duplicidade)
     - Alertas: limpos (`[]`)
   - Linha 10 (Cota 2820, item `98dfcaea-25b5-422d-87d0-5b4da7803bc4`) vinculada com sucesso à previsão `d1032349-6333-48a6-b9cb-bcf882d9af67`.
     - Status: `VINCULADO_MANUAL`
     - Valor liquidado: R$ 636,00 (exato, sem duplicidade)
     - Alertas: limpos (`[]`)
3. **Teste de Idempotência:**
   - Chamada repetida do vínculo executada com sucesso sem duplicar lançamentos no livro razão (`financeiro_recebimento_itens: 1`).
4. **Testes Automatizados:**
   - `vitest run src/lib/erp/repasse-canonico-203-contract.test.ts`: 4 passed.
   - `vitest run src/lib/erp/exclusao-repasse-recriacao-214-contract.test.ts`: 4 passed.
   - `npx tsc --noEmit`: 0 erros de tipo.
