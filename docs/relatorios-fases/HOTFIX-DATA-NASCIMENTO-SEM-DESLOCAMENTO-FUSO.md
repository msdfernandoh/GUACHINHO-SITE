# Hotfix — data de nascimento sem deslocamento de fuso

## Problema

A consulta de uma contratação exibia `21/01/1988`, embora o valor civil
persistido e carregado pelo formulário de edição fosse `1988-01-22`.

## Causa

O formatador compartilhado convertia a string SQL `date` com
`new Date("1988-01-22")`. O JavaScript interpreta esse formato como meia-noite
UTC; em fusos negativos, a apresentação local recuava para o dia anterior.

## Correção

Strings estritamente no formato `AAAA-MM-DD` agora são formatadas diretamente
como `DD/MM/AAAA`, sem criar um instante temporal. Valores `Date` e timestamps
continuam usando `Intl.DateTimeFormat`, preservando o comportamento destinado a
instantes reais.

Não houve migration nem alteração de dados: o valor correto já estava
persistido. O formulário de edição continua enviando a mesma data civil.

## Validação

- regressão unitária para `1988-01-22` → `22/01/1988`;
- cobertura de valor ausente e timestamp;
- verificação direcionada do teste e do TypeScript/lint do arquivo alterado.
