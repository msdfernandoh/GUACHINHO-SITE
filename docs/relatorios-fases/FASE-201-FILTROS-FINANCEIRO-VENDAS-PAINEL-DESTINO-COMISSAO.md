# Fase 201 — Filtros mensais, indicadores de vendas e destino da comissão

Data: 01/09/2026

## Financeiro e Caixa

O painel passa a aceitar mês de referência ou **Todos**. Entradas, saídas,
movimentações, extrato dos sócios e crédito fiscal respeitam o período. Para um mês
anterior, o saldo bancário é reconstruído até o último dia da competência a partir do
saldo inicial e do livro append-only.

Pagamentos de comissão exigem conta de saída e permitem conta de entrada opcional. Na
ausência de escolha, permanece a resolução automática pela conta vinculada ao
participante. Origem e destino são validados no mesmo tenant e não podem ser iguais.

A entrada de R$ 6.187,50 anteriormente atribuída à conta Fernando é redirecionada por
transferência compensatória para Gauchinho Particular. Os fatos do pagamento original
não são removidos ou editados.

## Vendas e Cotas

A competência usa `data_primeira_parcela`, com `data_venda` somente para legado. O
filtro oferece cada mês disponível e **Todos**. Cinco cards grandes consolidam o recorte:
valor vendido, meta empresarial vigente, falta para a meta, comissões geradas aos
participantes e valor bruto gerado para a empresa. Metas e previsões vêm das tabelas
canônicas tenant-aware, sem percentuais ou metas presumidas.

## Painel

Os cards Vendas, Comissão da Franquia e Comissão dos Participantes passam a navegar,
respectivamente, para Vendas & Cotas, Comissões da empresa e Minhas comissões.
