# Baixa integral do relatório e preservação do PDF — 21/10/2026

## Pedido e erro encontrado

O titular determinou que cada comissão seja baixada pelo valor da linha do
relatório, e contestou a suposta diferença financeira de R$ 965,42.

O sistema tinha usado o cabeçalho importado de R$ 8.352,58 como teto para sete
linhas que somam R$ 9.318,00. O saldo restante deixou a cota 0656 de Luiz com
R$ 534,58 em vez dos R$ 1.500,00 expressos na linha. Esse limite era uma regra
do software; não constitui prova de falta de pagamento ou inadimplência de Luiz.

Migration 328 remove o corte por saldo na sincronização canônica de itens de
repasse. Mantém locks, validação de empresa, valor canônico da linha, impostos,
rateio, bloqueio de redução de comissão já paga e eventos append-only.
Baixa e vínculo repetidos não duplicam valores. Não modifica as regras de
transferência bancária ou de disponibilidade de caixa.

## Aplicação operacional

Cota 1553/0656 passou a liquidada em R$ 1.500,00, por complemento append-only de
R$ 965,42. Seu alerta de limite e a observação antiga de baixa parcial foram
removidos após liquidação. Cinco cotas de Luiz totalizam R$ 8.250,00 baixados.
As sete linhas alocadas do lote somam R$ 9.318,00. Repetição testada sem duplicação.

Recebimento original, movimentos bancários e pagamentos foram preservados por
hash antes/depois. Não foi criado ingresso bancário para fazer coincidir totais.
A diferença entre dados importados não é tratada como dívida de Luiz; o aviso
da tela pede conferência do total importado, mantendo a comissão integral.

## Segundo defeito confirmado: PDF vazio

O código passava o mesmo Uint8Array ao leitor PDF.js e depois ao Storage. O
leitor transfere o ArrayBuffer ao worker e deixa o original destacado, vazio.
Reprodução local com PDF válido: 2.044.893 bytes antes e zero depois da leitura.
Os oito objetos de conciliação financeira existentes estão salvos com zero bytes,
conforme metadados do Storage e downloads. Não há outra cópia do relatório de
05/10 no bucket da empresa.

Correção: enviar cópia ao leitor e preservar bytes originais para upload.
O caminho por SHA-256 permite upsert dos mesmos bytes para recuperar objetos
vazios quando o titular reenviar o arquivo. Falhas de upload não são ignoradas.
Teste simula a transferência real do buffer e confere bytes enviados ao Storage.

O PDF vazio impede comprovar de onde foi extraído R$ 8.352,58. Não foi confirmado
que esse seja o total real do relatório ou do depósito, nem que exista diferença
real de caixa. Necessário reenviar REPASSE 05-10.pdf para confrontar cabeçalho,
pedidos e linhas e corrigir o dado de origem com evidência. Arquivo solicitado ao
titular durante esta fase; não reconstruir documento ou alterar depósito por
suposição. A baixa integral já está corrigida independentemente desse reenvio.

## Verificação

- 76 testes de repasses passaram em 20 arquivos, incluindo execução SQL PGlite
  da função real: baixa com total menor, complemento de 534,58 para 1.500,
  repetição, rateio sem deriva, comissão paga protegida e isolamento de empresa.
- TypeScript sem erros.
- Build de produção concluído.
- Aplicação real primeiro sob rollback, depois commit, com assertions dos valores,
  contagem de eventos e hashes de preservação financeira.
- Advisors antes/depois comparados, sem alterações de privilégios ou políticas.
- Migration 328 registrada como aplicada no projeto vinculado.
