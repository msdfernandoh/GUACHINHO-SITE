# Análise — Primeiro fechamento dos sócios com caixa centralizado

Data: 28/09/2026. Status: diagnóstico, decisões confirmadas, 12 baixas antecipadas estornadas e conciliação restante pendente. Duas contas fiscais foram classificadas para consumir a reserva. Nenhum movimento de caixa, comissão, fechamento, migration ou implantação foi criado ou alterado.

## Auditoria adicional das baixas antecipadas (28/09/2026)

O titular determinou que o primeiro acerto use somente contas efetivamente pagas, sem lançamentos futuros ou em aberto, e solicitou investigar baixas indevidas de contas ainda não vencidas. Consulta restrita à empresa confirmou **15 contas marcadas pagas com vencimento posterior a 28/09, somando R$ 21.852,01**. Em 14 delas, atribuídas a Eroni, as baixas ocorreram em sequência em 24/09 entre 14:32 e 14:34 UTC. Total: **R$ 21.773,01**. Duas vencem em 30/09 (Eventos, R$ 4.000; Material de Limpeza, R$ 1.300); onze vencem em outubro; uma em novembro. Nenhuma tem comprovante ou movimento de caixa vinculado. A conta restante, **R$ 79 de Fernando**, tem vencimento lançado em **05/08/2029** e pagamento em 25/08/2026; pode ser erro de data, não baixa indevida. Não estornar essa conta automaticamente.

| Vencimento | Conta atribuída a Eroni | Valor |
|---|---|---:|
| 30/09 | Eventos | R$ 4.000,00 |
| 30/09 | Material de Limpeza, Outras despesas | R$ 1.300,00 |
| 01/10 | Ar condicionado escritório, parcela 3/10 | R$ 350,00 |
| 07/10 | Salário Zeladora | R$ 1.500,00 |
| 07/10 | Salário | R$ 2.500,00 |
| 09/10 | Papel de parede, parcela 3/6 | R$ 479,00 |
| 10/10 | Impressora, parcela 3/8 | R$ 114,01 |
| 15/10 | Piscineiro | R$ 350,00 |
| 15/10 | Aluguel | R$ 3.500,00 |
| 20/10 | Internet | R$ 180,00 |
| 20/10 | Energia | R$ 700,00 |
| 30/10 | Eventos | R$ 4.000,00 |
| 30/10 | Material de Limpeza, Outras despesas | R$ 1.300,00 |
| 07/11 | Salário Zeladora | R$ 1.500,00 |

O histórico (`financeiro_contas_pagar_logs`) confirmava ação `BAIXA` nas 15 contas, sem motivo ou evidência de quitação. O campo de pagamento antecipado é permitido pelo sistema e cinco outras contas, já vencidas no corte, foram legitimamente ou possivelmente antecipadas; por isso, a mera diferença entre data de baixa e vencimento não prova erro. O titular autorizou expressamente estornar **as contas atribuídas a Eroni com vencimento após 30/09**; as duas de 30/09 e a de Fernando com data 2029 ficaram fora.

O estorno das **12 contas, R$ 16.473,01**, foi executado em uma única transação via `rpc_estornar_conta_pagar`. Antes da execução, a transação confirmou empresa, ids, Eroni como pagador, status pago, data da baixa 24/09, vencimento em outubro/novembro, ausência de movimento de caixa e soma exata. A identidade do usuário master Fernando foi estabelecida no contexto da sessão SQL, em conformidade com a autorização expressa dele; a RPC confirmou a permissão e gravou 12 logs `ESTORNO` atribuídos a esse usuário. A transação confirmou as 12 contas abertas ao final. Leitura independente posterior via API confirmou 12 contas `aberta`, `pago_em = null`, 12 logs e soma de R$ 16.473,01. Como eram marcadas pessoais e não havia `caixa_movimento_id`, a RPC não criou movimento compensatório de caixa.

Após a correção: **126 contas pagas, R$ 84.838,29**; **48 abertas, R$ 68.490,06**. Entre as pagas com vencimento posterior a 28/09, restam só as duas de 30/09 (R$ 5.300,00) e a de Fernando com data 2029 (R$ 79,00). A origem real das duas de 30/09 e a data correta da conta de Fernando continuam pendentes.

No código local, a Central passa a excluir contas abertas e guias fiscais do rateio de despesas pagas. A tela de baixa exige confirmação explícita quando o pagamento informado antecede o vencimento, com validação também no servidor. Essas proteções ainda não foram implantadas.

Verificação do complemento: `npx tsc --noEmit --pretty false` aprovado; 45 testes direcionados aprovados; `git diff --check` sem erro. Os testes não demonstram que as 14 despesas não foram pagas: essa é uma confirmação operacional ainda pendente.

## Evidências

Consulta ao Supabase, restrita à empresa Gauchinho (`7170f38e-15dd-4b19-8588-51e9a9cf0d4c`), e inspeção das actions, componentes, migrations e relatórios do módulo. A tabela abaixo registra a posição **antes dos 12 estornos**; a posição atual está na auditoria adicional acima. Valores históricos consultados não são exclusivamente de setembro e não constituem saldo conciliado com extrato bancário real.

| Registro existente | Quantidade | Valor |
|---|---:|---:|
| Contas pagas | 138 | R$ 101.311,30 |
| Pagas pessoalmente por Fernando | 20 | R$ 9.790,61 |
| Pagas pessoalmente por Eroni | 117 | R$ 90.028,06 |
| Pagas pela empresa | 1 | R$ 1.492,63 |
| Contas abertas | 36 | R$ 52.017,05 |
| Saldo do sistema em Gauchinho Empresa | — | R$ 37.008,69 |
| Reserva calculada pela regra atual | — | R$ 10.349,70 |

Duas contas chamadas `imposto`, de R$ 4.751,41 e R$ 4.928,84, estão pagas em 24/09/2026, atribuídas pessoalmente a Eroni e com `retirar_reserva_impostos = false`. Total: R$ 9.680,25. Caso ambas sejam guias cobertas por essa reserva, o saldo resultante dessa classificação seria R$ 669,45, sujeito à conferência da origem fiscal.

Há cinco pagamentos confirmados de comissão aos sócios: três de Fernando, totalizando R$ 10.258,78, e dois de Eroni, totalizando R$ 23.274,67. O relatório de reconciliação de 24/09 registra transferências desses valores das contas particulares para a PJ; isso não desfaz o pagamento nem explica sozinho se a comissão permaneceu um direito individual ou foi consumida em despesas.

O ledger contém um crédito de R$ 9.300 para Fernando e débito correspondente para Eroni, ambos de classificação histórica, com descrição de comissão de Fernando utilizada na operação. Sua relação com o dinheiro próprio de R$ 9.790,61 e com as comissões registradas deve ser esclarecida antes de retificar.

Não existem registros em `financeiro_fechamentos_socios` para a empresa consultada.

## Decisões do titular em 28/09/2026

- As comissões pertencem individualmente aos sócios e ficam sob guarda da empresa.
- Fernando não retirou dinheiro de suas comissões. A baixa de R$ 10.258,78 foi apenas no sistema; os R$ 9.300 do ajuste histórico parecem pertencer a esse montante, e não representam novo aporte.
- Fernando pagou R$ 9.790,61 com dinheiro próprio.
- As baixas de comissões de ambos os sócios não representam saques físicos. Os recursos permanecem na empresa.
- Ambas as guias fiscais pagas consomem a reserva de comissões.
- Primeiro fechamento acumulado, até 28/09/2026.

## Atualização fiscal já aplicada

Em 28/09/2026, foram marcadas `retirar_reserva_impostos = true` somente nas contas `145036bd-e661-4884-a0f5-b4fda5d82994` (R$ 4.751,41) e `11017c2c-a96d-4c40-a65b-60b394111763` (R$ 4.928,84), ambas pagas em 24/09/2026 e da empresa Gauchinho. Leitura pós-escrita confirmou exatamente essas duas linhas. A reserva segundo a fórmula atual fica R$ 10.349,70 − R$ 9.680,25 = R$ 669,45. Essa atualização de classificação não cria movimento bancário.

## Bloqueios descobertos na conciliação

- Os cinco repasses Racon confirmados totalizam **R$ 54.970,35**, mas a conta auxiliar Gauchinho Empresa contém entradas de repasse de apenas **R$ 37.008,69**. O repasse confirmado de **R$ 17.961,66**, datado de 17/09/2026, não possui lançamento correspondente em `financeiro_conta_movimentos`.
- O extrato auxiliar da conta contém 28 movimentos no total e nenhuma categoria de saída de contas pagas. Assim, o saldo de R$ 37.008,69 apresentado como caixa PJ não comprova quanto há no banco depois das 138 contas pagas. O saldo real precisa ser conciliado contra extrato bancário antes de permitir pagamento/retirada.
- As 117 contas atribuídas pessoalmente a Eroni somam **R$ 90.028,06**; superam os cinco repasses Racon registrados em **R$ 35.057,71**. A origem dessa diferença foi perguntada ao usuário. Não transformar automaticamente esse valor em capital próprio de Eroni nem inventar entrada de caixa.
- Entre todas as contas marcadas pagas, **20 contas (R$ 22.227,72)** têm vencimento posterior à data informada de pagamento; **15 (R$ 21.852,01)** vencem depois do corte de 28/09, incluindo 11 de outubro, uma de novembro, duas do fim de setembro e uma com competência 2029-08. Isso pode ser antecipação real ou baixa indevida. A data de pagamento não é prova bancária suficiente.
- Dois pares possuem mesma descrição, valor, competência e vencimento: aluguel de setembro por R$ 3.500 em duas linhas e produto de limpeza por R$ 80,55 em duas linhas. Conferir comprovantes antes de tratar como duplicação.
- A comissão líquida proporcional às previsões da franquia recebidas é **R$ 45.350,48**; as comissões elegíveis dos sócios somam **R$ 47.782,18** e as dos demais participantes **R$ 1.009,07**. Uma subtração direta daria margem negativa de **R$ 3.440,77**. As bases e snapshots precisam ser reconciliados por item antes de afirmar lucro comum. O imposto proporcional da franquia, R$ 9.619,87, também difere do imposto atribuído aos participantes, R$ 10.349,70. Não somar ambos como se fossem dois impostos independentes.
- A baixa contábil de R$ 33.533,45 em comissões dos sócios e o retorno às contas da empresa estão no histórico. O direito individual precisa permanecer visível sem criar saque novo ou novo aporte fictício.
- O ajuste histórico de R$ 9.300 foi gravado no ledger como crédito de Fernando e débito de Eroni. Diante da nova explicação, não pode aumentar o adiantamento de Fernando além dos R$ 9.790,61 nem diminuir uma contribuição pessoal de Eroni que o usuário nega. A reversão deverá preservar o histórico e ser calculada junto ao novo ledger de comissões sob guarda, evitando efeito duplicado.

O botão de fechamento existente chama `rpc_fechar_socios`, que congela exclusivamente as despesas marcadas como pagas pessoalmente e ignora o modelo confirmado de margem comum, comissão sob guarda e reserva fiscal. **Não executar esse RPC para o primeiro fechamento** até que o contrato e os saldos estejam reconciliados; um fechamento resultante seria imutável e materialmente incorreto.

## Proteção preparada na aplicação

A action `fecharSociosPeriodo` recusa um período que contenha guia fiscal paga pessoalmente com reserva marcada ou comissão elegível, pois a RPC antiga ignora essas dimensões. A action antiga de classificação fixa de R$ 9.300 foi encerrada para não criar outro crédito duplicado. A Central apresenta aviso explícito de conciliação quando detecta o caso histórico com ajuste e guia fiscal, indicando que os cards antigos de acerto/saque não servem para transferências. Essas alterações estão no código local; não são uma implantação de produção nem o novo motor do fechamento.

Verificação local: `npx tsc --noEmit --pretty false` aprovado; 34 testes direcionados de conta corrente e governança financeira aprovados; `git diff --check` sem erro. Releitura remota confirmou exatamente duas guias marcadas, somando R$ 9.680,25.

## Problemas encontrados

- O bloco de acerto usa o total de despesas pagas, incluindo guias fiscais marcadas, para calcular responsabilidade societária; não deduz a margem comercial antes do rateio.
- O pagador pessoal registrado é tratado como fornecedor de dinheiro próprio; isso conflita com a informação do usuário de que pagamentos executados por Eroni usaram recursos da empresa.
- A receita apresentada no card subtrai pagamentos de vendedores não sócios da comissão líquida da franquia, mas pode incluir valores pertencentes aos sócios e valores ainda devidos aos vendedores. Não é uma margem comum confiável para abatimento automático.
- O caixa livre desconta reserva fiscal e outras reservas, sem uma segregação completa das comissões individuais ainda devidas. Não representa automaticamente valor autorizado para retirada.
- A faixa chamada HOJE mistura saldos históricos com acerto limitado pelo período selecionado.
- A RPC de fechamento existente apura despesas pessoais e equalização; sua regra deve ser alinhada ao novo modelo, além da interface.

## Modelo proposto para decisão

1. Recebimentos da Racon entram na empresa; contas empresariais saem da empresa. A origem pessoal de Fernando permanece identificada quando comprovada.
2. Separar dinheiro sob guarda da empresa e titularidade: comissão de sócio guardada na PJ não se torna automaticamente receita compartilhada.
3. Margem comum: recebimentos comerciais atribuíveis aos consultores/microfranqueados, menos impostos reservados pertinentes e comissões devidas aos participantes, mesmo quando ainda não pagas. Deduplicar por previsão/venda/cota para não descontar imposto ou participante duas vezes.
4. Despesas para dividir = despesas operacionais do período menos margem comum do mesmo período. Exemplo fornecido: R$ 10.000 menos R$ 2.000 = R$ 8.000, sendo R$ 4.000 para cada sócio. Definir destino de eventual excedente de margem.
5. Mostrar por sócio: comissão líquida sob guarda da empresa + adiantamentos pessoais ainda não devolvidos - parte das despesas - retiradas/compensações já realizadas, com transporte explícito do saldo anterior. Cada fato entra uma única vez.
6. Impostos pagos saem do banco e consomem a reserva fiscal, sendo excluídos do rateio operacional acordado. Expor reserva negativa/insuficiência, sem ocultar valores.
7. Direito a receber e possibilidade de pagar hoje são indicadores separados. Demonstrar cobertura por caixa depois dos impostos, obrigações de participantes e compromissos acordados.

## Tela sugerida

- **Dinheiro da empresa:** saldo do sistema, impostos separados, comissões sob guarda, contas ainda a pagar e caixa disponível para o fechamento.
- **Conta da divisão:** despesas operacionais, margem dos consultores, restante para dividir, percentual e parte de cada sócio.
- **Acerto de Fernando e Eroni:** composição simples e frase final dizendo quanto receber, quanto deixar da comissão ou quanto completar.

Filtro explícito de início e fim; primeiro fechamento acumulado sugerido até a data acordada. Detalhes de lançamentos recolhíveis; impressão do demonstrativo; fechamento com snapshot imutável, autoria, versão de cálculo e sem duplicar períodos anteriores. Previsões futuras em seção própria.

## Questões pendentes

- Comissões pessoais continuam pertencendo a cada sócio e apenas ficam guardadas na empresa, ou todas viram receita comum?
- Os pagamentos confirmados foram transferências bancárias reais seguidas de devolução, ou baixas feitas somente no sistema?
- O crédito histórico de R$ 9.300 é comissão adicional, dinheiro próprio mal classificado ou parte do mesmo conjunto de despesas de R$ 9.790,61?
- As duas contas de imposto devem consumir a reserva de comissões? Como tratar eventual insuficiência e valores fiscais fora dessa reserva?
- O primeiro fechamento abrange todo o histórico até 28/09/2026 ou outro corte? Definir depois a utilização ou guarda do saldo positivo individual.

## Próxima etapa

Com as respostas, preparar uma prévia por lançamento e uma reconciliação de saldos antes/depois. Retificações devem preservar comprovantes, datas, tenant e autoria, usar reversões/movimentos compensatórios quando houver fatos imutáveis e impedir repetição por idempotência. A reassociação de contas de 24/09 não deve gerar nova entrada ou nova saída duplicada. Conferir o saldo resultante contra o extrato real antes do primeiro fechamento.

Arquivos centrais da análise: `gauchinho-app/src/app/erp/conta-corrente-socios/actions.ts`, `gauchinho-app/src/components/erp/financeiro/conta-corrente-central-socios.tsx`, `gauchinho-app/src/app/erp/contas-pagar/actions.ts` e migrations 134, 135, 187, 219, 223 e 285. Implementação e correções financeiras permanecem pendentes das definições de negócio.
