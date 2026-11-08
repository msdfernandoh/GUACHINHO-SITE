# Lance livre máximo por grupo — 1193 e 1253 — 08/11/2026

## Análise

Os grupos 1193 IMÓVEL e 1253 possuem histórico de resultados de assembleia
com lances livres confirmados. A regra de máximo fixo só é aplicada quando
todos os lances livres válidos da última assembleia são iguais. Nessa condição,
os valores encontrados foram:

- Grupo 1193: **23,3352%**.
- Grupo 1253: **47,7816%**.

O percentual de lance embutido de 25,1% é uma regra diferente e não foi usado
como máximo do lance livre.

## Correção

- A tela de Lances e Estratégias passa a carregar o lance livre como máximo fixo
  somente quando todos os lances livres válidos da última assembleia são iguais.
- Ao abrir uma cota, o percentual e o valor do lance livre já são sugeridos
  com esse máximo quando a cota ainda não possui valor configurado.
- Foi incluído o botão `Usar máximo fixo` para reaplicar o valor rapidamente.
- A validação do servidor impede ultrapassar o máximo apenas quando ele é fixo.
- O valor continua editável para lançar abaixo do máximo.

Quando o teto fixo estiver caracterizado, a tela exibe um checkbox para o
operador escolher usar o teto e o maior percentual de lance embutido permitido.
Somente com essa opção marcada o salvamento aplica os dois máximos; os demais
clientes podem informar outro lance dentro do limite.

O valor em reais do lance livre é convertido usando o `saldo_devedor` da opção
da cota (`grupos_cotas`), e não o valor do crédito contratado. A conversão é
bidirecional na tela: percentual para reais e reais para percentual.

Sem alteração de schema ou dados operacionais; a regra é calculada a partir do
histórico preservado de `grupo_assembleias_resultados`.
