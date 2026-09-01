# Fase 197 — Painel mensal de comissões da empresa

A conferência de comissões ganhou filtros independentes de competência, com a
opção **Todos**, no painel principal, próximos recebimentos, histórico recebido
e pagamentos dos participantes. Cada seção apresenta cards próprios de soma ao
ser aberta.

O indicador **Gerado para a empresa** usa a comissão bruta da franqueadora na
competência. Os pagamentos são agrupados pelo nome do participante; todas as
identidades comerciais ativas aparecem, inclusive sócios sem regra e, portanto,
com R$ 0,00 gerado. Participantes inativos continuam identificados no histórico,
sem poluir a relação de ativos sem movimento. As comissões ficam como subitens com seleção individual,
seleção de todas as disponíveis e pagamento único ou múltiplo.

No servidor, itens selecionados do mesmo participante e competência são
consolidados em uma operação financeira idempotente, preservando tenant,
elegibilidade e vínculo de cada previsão. A tela Minhas Comissões também nomeia
explicitamente o card mensal de comissões geradas para o participante.
