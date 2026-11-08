# Correção do terminal e do embutido dos robôs de lance — 08/11/2026

## Problema observado

O terminal de uma execução de lances era classificado como contemplação porque o
nome do robô continha as duas palavras (“Contemplações e Médias de Lance”). Com
isso, o resumo procurava eventos de grupos em vez de eventos de cotas e mostrava
`0/—`, mesmo havendo processamento de lances.

Na mesma execução o Newcon rejeitou uma oferta porque o embutido informado era
R$ 266.508,25, superior ao valor total da oferta de R$ 166.567,66. A mensagem
era aceita pelo listener como um alerta comum e o fluxo podia registrar um
“Confirmado via Web” indevido.

## Correção aplicada

- O tipo da execução agora prioriza `tipo_rotina` persistido e, na ausência dele,
  identifica o padrão dos logs (`Processando ofertas da Cota` ou `Processando
  Grupo [x/y]`). O terminal de lances passa a exibir quantidade e progresso de
  cotas corretamente.
- O robô captura o saldo devedor da tela da cota e limita o percentual de
  embutido pelo valor real da oferta: a oferta é calculada sobre o saldo devedor,
  enquanto o embutido é percentual do crédito contratado.
- Mensagens do Newcon no formato “valor do Lance Embutido ... maior que o valor
  gerado pela oferta” agora são falhas bloqueantes. O protocolo/comprovante não é
  tratado como sucesso quando o portal rejeita a operação.
- O limite do worker também prioriza `tipo_rotina`; o nome histórico do robô não
  pode transformar a rotina de lances em contemplação nem selecionar o limite
  legado de dez minutos.

## Validação

- `node --check scripts/robo-lances-service.mjs`: aprovado.
- `npx tsc --noEmit` em `gauchinho-app`: aprovado.
- `git diff --check`: aprovado; apenas avisos de conversão de final de linha do
  checkout foram emitidos pelo Git.

Não foi executada nova oferta real durante esta correção, para evitar duplicar
lances no Newcon. A próxima execução deve ser acompanhada no terminal e precisa
confirmar o protocolo e os comprovantes por modalidade.
