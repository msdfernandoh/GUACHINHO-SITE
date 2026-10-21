# Ajustes de repasse e consulta SNP — 21/10/2026

## Execução autorizada
Orlei, Ramon e Ivani: terceira parcela de R$ 1.250,00 ajustada para R$ 1.332,60 e liquidada pelo relatório de 15/10. Diferença histórica: R$ 82,60 a maior por cota. Franciomar: terceira parcela de R$ 636,00 ajustada e liquidada a R$ 318,00 no lote 05/10, R$ 318,00 a menor para consulta. Decisões AJUSTAR_DIFERENCA e chaves determinísticas registram valores anteriores e motivo. UI exibe diferenças em vermelho sob cliente nas linhas vinculadas, visíveis por padrão; alerta vermelho adicional quando valor vinculado é menor que linha.

Baixa é alocação do repasse recebido e liberação de comissão proporcional, não transferência bancária ao consultor. Não houve financeiro_pagamentos novo. O limite do recebimento foi preservado: não criada entrada fictícia para compensar a diferença de R$ 965,42 do lote 05/10.

## Correção financeira necessária
A sincronização repetida do ajuste reconstruía o bruto de participante a partir do líquido arredondado. Isso mudava a razão na segunda chamada, derrubava R$ 1.099,39 para R$ 1.099,38 e violava elegibilidade <= previsão. Migration 326 persiste razao_participante no snapshot e atualiza elegibilidade junto da previsão. Sem backfill global. Testada em PGlite com valores reais, reentrada, redução de parcela, proteção de comissão paga e limite bancário. Testada também no banco real sob rollback antes de COMMIT. Função corrigida e quatro ajustes aplicados na mesma transação. Migration registrada como 326 aplicada.

Hashes transacionais garantiram movimentos bancários, financeiro_pagamentos e previsões com valor_pago>0 inalterados. Verificação posterior confirmou quatro vínculos e valor_previsto=valor_liquidado=relatório. Repetições de sincronização preservaram valores e elegibilidade.

## Luiz Carlos
Não encontrado nos clientes, vendas/cotas vendidas, cotas definitivas, leads, propostas ou contratações da empresa. Criado cliente mínimo id 793cf56d-0078-499c-a5cc-e9ae9ccffef4, com nome do relatório e pendências de documento/responsável. Não inventados CPF, titularidade de consultor ou percentual. Cinco cotas do grupo 1553, números 0137,0308,0467,0515,0656, somam R$ 8.250,00; comissão do vendedor e cadastro das cotas ainda dependem da identificação do participante responsável e seu valor/regra. O comissionado no cabeçalho do lote não prova autoria de todas as vendas.

## SNP Vertical no portal
Provisionado robô pontual id 7094f577-3813-47f8-87bc-1dfd2a2984b3, inativo para agendamento, usando credencial global Racon já cadastrada pelo fluxo existente, tenant explícito e cotas_alvo_ids restrito às três cotas. Nenhuma oferta de lance ou comunicação enviada.

Primeira execução enviava grupo “5288 VEÍCULO”, truncado pelo portal, retornando consorciado inválido. Corrigido código numérico/padding. Segunda execução localizou 005288/1176, 005288/1552 e 005288/1617. Capturas de atendimento mostram em cada cota “NÃO CONTEMPLADA/ATRASO”, Atraso(s) 001 e R$ 799,54: total R$ 2.398,62. O próximo vencimento mostrado é 10/11/2026; o detalhamento do boleto atrasado de outubro não foi baixado. Não afirmar confirmação do mês apenas pelo saldo acumulado. O atraso é evidência de inadimplência atual; relação causal com a comissão ausente é hipótese plausível, não comprovada por demonstrativo de comissão da administradora.

Download falhou porque o seletor escolhia link oculto do menu; corrigido para link visível, ainda sem nova homologação de download. Não confundir execução concluída com zero boletos com adimplência: os erros por cota estão nos logs. Evidências locais: tmp/robo-screenshots/racon-boletos-02-atendimento-5288 VEÍCULO-{1176,1552,1617}.png. Não publicados documentos pessoais no Git.

## Validação
17 testes direcionados aprovados. TypeScript aprovado; lint direcionado sem erros, dois avisos preexistentes em efeitos React do componente. Build de produção aprovado. Suíte completa: 1.859 aprovados, 37 ignorados preexistentes, zero falhas. Nenhuma transferência bancária real executada.
