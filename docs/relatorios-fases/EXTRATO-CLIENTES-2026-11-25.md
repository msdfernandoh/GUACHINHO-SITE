# Extrato de Clientes

Menu operacional com busca por nome, grupo ou cota e paginação de 25 clientes.
Cada cliente abre todas as cotas, com histórico do mês atual, últimos 12 meses
ou desde a adesão. O PDF usa o mesmo conjunto e pagina automaticamente.

O crédito inicial usa o preço vigente na adesão no histórico Newcon do bem.
O total de parcelas é uma simulação desde a primeira assembleia da cota,
considerando pagamentos em dia e reajustes proporcionais ao histórico do
crédito. Não usa baixas financeiras. Troca de bem bloqueia o total estimado
para conferência. A taxa do último reajuste do indexador alimenta as projeções
de 3 e 5 anos.

A proximidade usa a distância absoluta entre números da cota do cliente e
resultados ativos, dividida pela capacidade total do grupo. O melhor resultado
do período é destacado por assembleia. A referência não implica participação
em lances nem probabilidade futura.

A fila por mês seleciona clientes com reajuste registrado no histórico da cota.
Mensagem de WhatsApp editável com emojis e variáveis, cópia e abertura manual
do WhatsApp. O PDF deve ser anexado na conversa. O registro manual de envio
usa cliente e competência, com RLS e unicidade para deduplicação futura.
O envio automático mensal é etapa futura.

A migração foi aplicada ao Supabase. Consulta com vínculo autenticado da
Gauchinho retornou 94 clientes e dois com reajuste em novembro de 2026.
O modelo de WhatsApp pode ser salvo e carregado no navegador do operador.

TypeScript e lint direcionado passaram. Três testes cobrem cálculos e
proximidade. Um teste adicional gerou o PDF consolidado com cinco cotas e
12 assembleias por cota. A conferência visual autenticada da tela e a
publicação da aplicação continuam pendentes.
