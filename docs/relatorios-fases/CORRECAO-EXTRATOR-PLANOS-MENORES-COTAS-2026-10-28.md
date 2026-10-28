# Correção do extrator de planos e proteção das menores cotas — 28/10/2026

## Pedido e resultado

Continuidade autorizada da análise e correção das parcelas inconsistentes das menores cotas. Implementada correção local do robô de importação. Não houve execução real do robô, reimportação, alteração do banco, migration, commit, push ou publicação. Os valores já cadastrados e apresentados em produção ainda precisam de conferência e reparação.

A nova tentativa de leitura em `eaeuoynprurmmulzhydt` falhou porque o conector respondeu `Unknown tool (supabase.execute_sql)`. A tentativa anterior havia sido interrompida por falha da revisão automática por limite de uso. Não se utilizou credencial local ou outro canal para contornar essa revisão. A consulta de todos os grupos continua preparada em `scripts/diagnosticos/auditar-menores-cotas.sql`, sem execução remota.

## Mudanças

- Novo módulo `scripts/robo-simulador-planos.mjs`, com extrator autocontido para `page.evaluate` e agrupamento validado.
- Planos precisam pertencer ao grupo esperado, ser visíveis e formar uma unidade com um crédito, uma mensalidade e uma modalidade explícita. Contêineres agregadores são descartados quando há cartões completos internos. Ausência de contexto de grupo ou modalidade aborta o lote daquele grupo.
- A redução vem do rótulo Reduzida 50/60/70%; percentuais de lance em outros trechos não alteram a classificação. Integral exige rótulo explícito.
- Clones visíveis idênticos são idempotentes. Duplicatas com parcelas conflitantes, ou taxas divergentes, interrompem o processamento antes da gravação do grupo/cotas e antes da inativação de ausentes.
- Taxas ausentes não recebem os antigos padrões 12% e 0,5%. Zero explícito é preservado.
- Criação de novo grupo foi movida para depois da validação da extração e do agrupamento.
- O mapa de grupos conserva candidatos de mesmo número e resolve pelo tipo canônico, em vez de sobrescrever pelo número. Falta ou ambiguidade de tipo interrompe o processamento sem escolher outro grupo por aproximação. A lista de tipos/produtos configurada no serviço não foi ampliada.
- O motor financeiro do site permanece intacto: parcelas oficiais não são substituídas indiscriminadamente por uma fórmula teórica.

## Validação

`node --test scripts/tests/robo-simulador-planos.test.mjs`: **12 testes aprovados**. Incluem execução serializada do extrator em contexto separado, cartões misturados, crédito em cabeçalho ancestral, confusão 60% versus lance 70%, grupo alheio, clone oculto, modalidade ausente, mensalidades múltiplas, taxas ausentes/zero, duplicatas conflitantes e resolução de número por tipo.

Teste integrado do serviço `executarRobo3Simulador` com página e cliente de banco simulados comprovou **zero insert/upsert/update** em planos ambíguos, sem cotas cadastradas. Não houve acesso de rede nesse teste. A reprodução histórica em `scripts/diagnosticos/reproduzir-contaminacao-planos.mjs` passa a ler o código legado do HEAD Git, preservando a evidência depois da substituição do extrator.

Verificação sintática dos módulos e `git diff --check` executadas. Não há alteração TS/TSX adicional nesta fase; as alterações anteriores de desempenho/mobile foram preservadas.

## Limitações e próximo passo

Sem acesso ao banco e ao DOM real autenticado do simulador, não há evidência suficiente para declarar homologação do portal, apontar todas as cotas afetadas ou confirmar a execução histórica que gravou cada parcela incorreta. O novo parser é deliberadamente estrito: se o portal omitir rótulo/modalidade ou contexto comprovável de grupo, o grupo falha em vez de importar dados inferidos. O serviço existente registra a falha por grupo e segue os demais; a operação completa não é uma transação entre grupos.

A correção de dados exige: obter o catálogo atual; conferir todas as menores cotas de Prorrogada/Diluída contra a tabela oficial; listar IDs e valores anterior/confirmado; aplicar somente os ajustes comprovados preservando snapshots de propostas, contratos e vendas. Nenhuma execução em lote do robô foi disparada para tentar reparar dados sem essa conferência.

## Reversão

Restaurar `scripts/robo-simulador-service.mjs` e remover o novo módulo e seus testes reverte a mudança local. Não há rollback de dados. Atualização do runner e homologação real permanecem pendentes.
