# Tela de inadimplência e acompanhamento de comissões

Proposta funcional — 21/10/2026. Automação desenhada; rotina mensal e nova tela ainda não implantadas.

## Objetivo e nomenclatura
Rota proposta `/erp/inadimplencia`, acessível pelo menu Financeiro e pelos indicadores de Comissões. Separar fato financeiro (comissão esperada não recebida), hipótese (cliente pode estar atrasado) e evidência (portal confirma atraso). A ausência em um relatório não prova sozinha inadimplência do cliente.

O titular propõe confirmar no encerramento do mês após o último repasse do dia 25. Implementar essa confirmação como **Repasse não recebido confirmado**. Usar **Cliente inadimplente confirmado** apenas com evidência de boleto atrasado ou posição de cobrança no portal. Não usar o corte do dia 25 para marcar antecipadamente antes de terminar o mês.

## Estrutura da tela
Cabeçalho: competência, administradora, responsável, cliente/grupo/cota, situação e data da última avaliação. Faixa “Repasse final do mês: recebido/conferido/aguardando”, com arquivo, pedido e data de aprovação separados da data bancária. Fuso America/Cuiaba.

Quatro cartões independentes, sem somar comissão bruta e débito do cliente:
1. Possível inadimplência: quantidade e saldo de comissão ausente.
2. Repasse não recebido após fechamento: quantidade e saldo de comissão.
3. Atraso confirmado no portal: cotas e total de parcelas do cliente quando conhecido.
4. Divergências de cadastro/vínculo/valor: quantidade e valor em conciliação.

Abas: Possíveis; Repasse não recebido; Atraso confirmado; Em conciliação; Regularizados; Histórico.

| Cliente/cota | Comissão/competência | Previsto / recebido / saldo | Último lote conferido | Situação | Evidência | Ações |
| --- | --- | --- | --- | --- | --- | --- |
| SNP Vertical · 5288/1176 | 4ª parcela · out/2026 | R$ 327,81 / R$ 0 / R$ 327,81 | 15/10 | Comissão atrasada; portal confirma atraso na cota | 1 parcela atrasada R$ 799,54, consulta 21/10; mês do boleto não confirmado | Ver comissão; consultar portal; histórico |

Sob cada linha: motivo em texto, valor e direção da divergência em vermelho, data/hora/fonte de evidência, tentativas do robô e eventual erro. Ausência de PDF/download não equivale a quitação. Mostrar também competência esperada, competência do lote e data real de recebimento: antecipações e recebimentos posteriores não são descartados pelo mês.

## Máquina de estados
- **Aguardando repasse:** previsão comercial válida, sem saldo recebido, mas ainda sem lote aplicável conferido.
- **Possível inadimplência:** previsão esperada até o lote analisado, saldo em aberto e sem linha correspondente, após excluir divergência/cadastro/etapa.
- **Em conciliação:** linha encontrada, porém sem vínculo, valor diferente, recebimento parcial, total do lote divergente, ambiguidade de cota ou falha de leitura. Não classificar como cliente inadimplente.
- **Repasse não recebido confirmado:** mês encerrado e lote final do dia 25 ou data efetiva reagendada importado/conferido; todos os lotes disponíveis confrontados e sem crédito correspondente. Confirma a ausência de repasse.
- **Cliente inadimplente confirmado:** evidência de atraso no portal com cliente/grupo/cota, consulta, parcela/vencimento quando disponíveis. Permite confirmação antes do fechamento, sem inventar causa contratual da comissão ausente.
- **Regularizado:** crédito recebido/alocado ou evidência atual de quitação. Manter estados separados de repasse e cliente: receber comissão resolve a pendência de repasse, mas não comprova que toda a dívida do cliente foi quitada.
- **Suspenso/cancelado/estorno:** trilha própria, fora da carteira de cobrança automática.

## Algoritmo após cada importação
1. Validar tenant, administradora, integridade do lote e data/competência, sem confiar apenas no nome do arquivo ou no status textual antigo.
2. Buscar previsões ativas pelo cronograma contratado. Contemplação só entra após gatilho/evento comprovado; futuras e canceladas ficam fora.
3. Usar o livro `financeiro_recebimento_itens` de recebimentos confirmados, incluindo compensações, para somar crédito de qualquer lote/competência. Não usar baixa do consultor como prova de repasse da franquia.
4. Cruzar empresa + administradora + cota + titular + etapa. Comparar cotas multicotas separadamente. Registrar ambiguidades para conciliação; não escolher só pelo valor ou nome.
5. Se a linha estiver em qualquer relatório e sem crédito, encaminhar para conciliação. Se não houver linha nem recebimento e a previsão estiver esperada, abrir ocorrência possível. Saldo parcial fica sinalizado, não gerar ocorrência duplicada do total.
6. Ocorrência única por empresa/previsão, eventos append-only de cada avaliação e reprocessamento idempotente. Não alterar competência original, não cancelar cota nem gerar pagamento/estorno.
7. Quando houver recebimento posterior, reduzir saldo e regularizar ocorrência; preservar datas originais e tempo em atraso.

## Fechamento mensal e dia 25
Configuração por administradora/empresa: dias esperados dos lotes (por exemplo 05, 15 e 25), ajustes por calendário e evidência de último lote. Dia 25 em feriado/fim de semana não deve disparar confirmação falsa; registrar data efetiva validada pelo gestor.

Após o fim do mês (primeira avaliação do mês seguinte, horário local), confirmar ausência somente se:
- cronograma está vigente e a comissão é devida naquele mês;
- lote final esperado foi importado e conferido, ou o gestor documentou que a administradora não emitiu lote naquele período;
- outros lotes do mês e recebimentos de outras competências foram verificados;
- não há problemas de processamento/cadastro/vínculo/valor/recebimento parcial relevantes à ocorrência;
- não houve recebimento posterior nem suspensão/cancelamento aplicável.

Se faltar lote final, exibir **Fechamento pendente de relatório**. Nunca transformar falha de upload/robô em confirmação de inadimplência. A verificação precisa ser reexecutada quando entrar lote retroativo/corrigido.

Agendamento proposto: avaliação diária e após importação; fechamento mensal após virada do mês. Rotina no servidor com escopo tenant explícito, sem depender de tela aberta. Não criada automação neste chat: trata-se de rotina do produto a implementar com worker/cron do repositório, não lembrete pessoal.

## Consulta pelo robô
Fila somente das cotas com ocorrência, priorizada por maior saldo/antiguidade. Portal precisa confirmar que abriu o titular e grupo/cota corretos. Normalizar grupo numérico e versão da cota. Capturar posição de cobrança, quantidade/valor atrasado, vencimento e competência dos boletos disponíveis. Critério do titular: boleto de outubro disponível na consulta indica parcela atrasada. Guardar evidência e data; não generalizar para meses futuros ou download inconclusivo.

Sem envio automático de cobrança, alteração de lance ou emissão de pagamento. Erros por cota ficam como **Consulta inconclusiva**, inclusive quando o processo geral termina sem boletos. Detectar credenciais expiradas, seletores ocultos e resposta consorciado inválido. Consultar não altera crédito ou saldo bancário.

## Modelo de dados proposto
Tabela `financeiro_inadimplencia_ocorrencias`: empresa_id, previsao_franquia_id, cota_definitiva_id, competencia_original, situacao_repasse, situacao_cliente, saldo_comissao, vencimento, data_primeira_ausencia, lote_ultimo_analisado_id, fechamento_competencia_id. Unique empresa/previsão.

Tabela append-only `financeiro_inadimplencia_eventos`: ocorrência, empresa, estado anterior/novo, motivo, usuário/robô/rotina, data, chave de idempotência, snapshot de totais e IDs dos lotes.

Tabela `financeiro_inadimplencia_evidencias`: empresa/ocorrência, origem, referência de arquivo protegido, hash, data da consulta, vencimento/competência e resultado. Não expor credenciais ou links públicos de boletos.

Tabela `financeiro_repasses_fechamentos`: empresa, administradora, competência, último lote esperado e efetivo, conferido_por, conferido_em, pendências. Não reutilizar lacre societário para este fim.

RLS por empresa e acesso comercial: gestor vê carteira autorizada; consultor apenas suas próprias comissões. Identidade N:N empresa_usuarios; participante vinculado pelo usuario_id interno, nunca auth.uid() direto. Transições via funções autorizadas; leitura e exportação preservam tenant. Trilha histórica não apagada.

## Implantação em fases
1. Marca operacional de atraso com evidência, já aplicada às três comissões SNP e exibida em Comissões/Minhas comissões. Status financeiro de liquidação permanece intacto.
2. Tela e motor de classificação em modo diagnóstico, com testes de dados históricos e comparação por gestor.
3. Integração da fila de consulta de atraso e evidências do portal.
4. Fechamento mensal explícito e automático, somente após comprovar o lote final; comparar resultado de dois ciclos antes de habilitar confirmação automática.

## Casos de aceite obrigatórios
Antecipação de novembro em outubro; pagamento em lote posterior; lote de 25 ausente; duplicidade; mesma cota com titular/versão diferente; multicotas; parcial; diferença de total do PDF; erro de parser; previsão sem regra; contemplação ainda não ocorrida; cota cancelada; correção por compensação; inadimplência portal com mês desconhecido; comissão recebida enquanto dívida do cliente continua; virada de mês em Cuiabá; isolamento entre empresas e consultores; reprocessamento sem duplicação.
