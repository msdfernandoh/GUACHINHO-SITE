# Lance livre máximo por grupo — 1193 e 1253 — 08/11/2026

## Análise

Os grupos 1193 IMÓVEL e 1253 possuem histórico de resultados de assembleia
com lances livres confirmados. A regra de máximo fixo só é aplicada quando
todos os lances livres válidos da última assembleia são iguais. Nessa condição,
os valores encontrados foram:

- Grupo 1193: **23,3352%**.
- Grupo 1253: **47,7816%**.

O percentual de lance embutido é uma regra diferente e não foi usado como
máximo do lance livre.

## Correção

- A tela de Lances e Estratégias carrega o lance livre como máximo fixo somente
  quando todos os lances livres válidos da última assembleia são iguais.
- Ao abrir uma cota, o percentual e o valor do lance livre são sugeridos com
  esse máximo quando a cota ainda não possui valor configurado.
- Foi incluído o controle para o operador usar o teto máximo e o maior
  percentual de lance embutido permitido.
- A validação do servidor impede ultrapassar o máximo apenas quando ele é fixo.
- O valor em reais do lance livre é convertido usando o saldo devedor da opção
  da cota (`grupos_cotas`), e não o valor do crédito contratado. Para cotas
  legadas sem saldo vinculado, é usado o valor-base preservado no snapshot da
  cota, evitando apresentar R$ 0,00 quando existe base histórica disponível.
- A conversão é bidirecional na tela: percentual para reais e reais para
  percentual.
- O recurso próprio do teto é exibido separadamente como `teto do lance livre -
  embutido utilizado`, em percentual e em reais.
- Percentuais operacionais de embutido são normalizados para inteiro; portanto
  uma regra armazenada como 25,10% é exibida e aplicada como 25%.
- A validade do lance permanece vazia até a execução do robô; salvar a
  estratégia não registra lance na administradora.

## Validação

- TypeScript validado com `npm exec tsc -- --noEmit` no projeto
  `gauchinho-app`.
- Não houve alteração de schema ou de dados operacionais; a regra é calculada
  a partir do histórico preservado de `grupo_assembleias_resultados`.

## Resultado esperado

Na cota do grupo 1253, com teto de `47,7816%` e embutido máximo de `25%`, a tela
deve mostrar:

- Lance livre: `47,7816%` e o valor correspondente ao saldo devedor;
- Embutido máximo: `25%` e o valor correspondente;
- Recurso próprio: `22,7816%` e o valor correspondente.
