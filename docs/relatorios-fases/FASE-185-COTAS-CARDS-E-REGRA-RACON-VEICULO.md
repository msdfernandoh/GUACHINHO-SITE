# Fase 185 — Cotas, cards mensais e regra Racon Veículo

## Sintomas confirmados

- A venda de Janser possuía duas cotas e previsões independentes no banco, mas a tela **Vendas e Cotas** exibia apenas uma linha agregada.
- Os cards de **Minhas comissões** não contabilizavam a venda na competência de recebimento da primeira parcela.
- Uma contratação do grupo Racon 5288 Automóvel exibia as três modalidades com `0,00%` e impedia a formalização pelo perfil Sócio.

## Causas

- A consulta de `cotas_definitivas` tentava selecionar a coluna inexistente `vendas.numero_grupo`. O erro era ignorado e a página criava uma cota sintética por venda, ocultando a cardinalidade real 1:N.
- O resumo mensal filtrava exclusivamente `vendas.data_venda`; a venda formalizada no início de setembro, com primeira parcela em agosto, ficava fora da competência agosto.
- A regra participante do perfil Sócio referencia o programa ativo que possuía apenas regras do tipo Imóvel, enquanto o catálogo veicular homologado estava em outro programa Racon ativo.

## Correções

- A listagem carrega as cotas sem relação PostgREST inválida, falha explicitamente em caso de erro e resolve cliente/consultor pela venda canônica já carregada.
- A tabela de cotas mostra cliente e consultor abaixo do número da cota.
- Os cards usam `data_primeira_parcela` como competência comercial, com `data_venda` apenas como fallback legado; a deduplicação continua por venda e a quantidade soma `quantidade_cotas`.
- A migration 185 copia percentuais e etapas já homologados do programa Racon Veículo para o programa vigente do perfil Sócio, por tipo e modalidade. Nenhum valor financeiro é criado por inferência.

## Preservação

- Nenhuma venda, cota, previsão, pagamento ou histórico existente é reescrito.
- A migration é idempotente por programa, tipo e modalidade.
- Tenant, administradora, perfil e vigência são resolvidos por vínculos canônicos.
