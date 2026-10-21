# Comissões atrasadas e projeto de inadimplência — 21/10/2026

## Aplicado
Três previsões SNP Vertical de outubro, quarta parcela, cotas 1176/1552/1617, grupo 5288: R$ 327,81, R$ 327,81 e R$ 327,83. Marca ATRASADA, origem PORTAL_ADMINISTRADORA, autor interno e motivo com evidência e limite documental. Propagada a previsões dos participantes vinculadas. SQL transacional verificou exatamente três registros antes de gravar; repetição não sobrescreve marca existente.

Não alterados status financeiro, competência, valor, elegibilidade ou baixa. Não executados pagamentos. Registro operacional em snapshot existente, sem migration. Alertas de comissão atrasada exibidos na tabela de Comissões da empresa e Minhas comissões. Leitor puro suprime marca quando saldo fica zerado, sem apagar evidência histórica ou presumir quitação de toda dívida do cliente.

## Projeto entregue
`docs/PROJETO-TELA-INADIMPLENCIA-REPASSES.md` contém tela, indicadores separados, tabela, abas, critérios de classificação, fechamento mensal, fila do robô, modelo de dados e casos de teste. O corte do dia 25 exige lote final efetivamente conferido e fim do mês, com calendário de administradora; lote ausente deixa fechamento pendente. Diferença/cadastro/vínculo gera conciliação e não acusação de inadimplência. Confirmação por ausência é rotulada repasse não recebido, distinguindo evidência de atraso do cliente. Tela nova e rotina automática ainda são proposta, não recursos implantados.

## Verificação
Dois testes do leitor aprovados, TypeScript aprovado; lint direcionado zero erros e um aviso any preexistente. Build de produção aprovado. Mudanças restringem-se à marca operacional e exibição, sem nova integração de cobrança.
