# Diagnóstico de menores cotas e primeira parcela — 28/10/2026

## Escopo e estado

Pedido: achar a origem das inconsistências nas menores cotas do seletor de todos os grupos. Somente análise de código, duas imagens do titular e reprodução isolada; sem alteração de aplicação, robô, banco ou dados comerciais. Alterações anteriores de desempenho/mobile preservadas.

Consulta remota não executada: a revisão automática da ferramenta Supabase falhou por limite de uso. Não houve consulta por caminho alternativo. Portanto, não é possível afirmar quais registros remotos, quantos grupos ou quais execuções efetivamente causaram o problema. Auditoria completa de todos os grupos permanece pendente.

## Evidência das imagens

| Crédito / soma, quantidade 1 | Saldo devedor | Parcela exibida | Base sem seguro implícita* | Referência teórica 60%, 72 meses* |
|---|---:|---:|---:|---:|
| R$ 36.561,63 | R$ 42.411,49 | R$ 1.195,05 | R$ 1.178,09 | R$ 370,39 |
| R$ 57.453,99 | R$ 66.646,63 | R$ 582,05 | R$ 555,39 | R$ 582,05 |

* Hipótese de fator 0,0004, seguro inicial sobre o saldo cheio, conforme a regra documentada. Referência teórica: saldo / 72 × 60%, com os arredondamentos do motor, mais seguro inicial. Não é homologação da tabela oficial da administradora, que precisa confirmar Prorrogada/Diluída e valores por modalidade. O seguro exibido na coluna da imagem é pós-contemplação e não deve ser subtraído da primeira parcela.

Nas imagens, crédito e soma estão coerentes: o select arredonda para reais inteiros, enquanto a coluna Soma mostra centavos. Lance de 25% e saldo pós-lance também coincidem com o saldo apresentado. A inversão forte aparece na primeira parcela da cota menor.

## Fluxo do seletor e cálculo

- `catalogo-autorizado-service.ts:256` ordena os créditos do maior para o menor. A menor opção não é necessariamente a primeira no DOM do site ou no portal de origem.
- `use-grupo-linha.ts:46` resolve a cota por `cota.id === config.cotaId`. `onCotaChange` guarda o UUID escolhido. Não foi encontrada associação por índice nesse caminho.
- `simulacao-linha.ts:347` usa `valor_credito × quantidade` para Soma.
- `simulacao-linha.ts:425` prioriza `parcela_reduzida_60` salva na cota para Red. 60%; campos específicos de 50/70%, JSON e legado seguem a mesma política.
- `simulacao-linha.ts:449` usa essa parcela persistida antes da fórmula. Assim, uma parcela contaminada no cadastro chega à tela, aos totais e aos fluxos que usam esse motor.
- O guard em `simulacao-linha.ts:440` só recusa parcela superior a 20% do crédito. Uma base de R$ 1.178,09 para R$ 36.561,63 fica abaixo de R$ 7.312,33 e passa. O guard não detecta divergência entre créditos, percentuais ou parcelas vizinhas.

## Defeito comprovado no extrator, candidato à origem dos dados

`scripts/robo-simulador-service.mjs:223–247`:

1. Seleciona todos os `div, article` do documento que contenham Crédito e Simular, sem exigir um único cartão nem limitar ao grupo expandido.
2. `innerText` de um ancestral agrega vários planos, inclusive cabeçalho de crédito e parcelas de filhos diferentes.
3. Regex independente captura o primeiro Crédito e a primeira parcela por mês desse texto, sem provar que pertencem ao mesmo plano.
4. O percentual é escolhido por presença de qualquer `70%`, `60%` ou `50%` no texto inteiro, com precedência 70 → 60 → 50. Até um percentual de lance em outro trecho pode reclassificar o plano.
5. O agrupamento em `porCredito` grava esses pares sem evidência de origem e aceita valores conflitantes no mesmo crédito/percentual. Não compara clones responsivos, duplicatas ou ancestral versus cartão.
6. O upsert em `:405–422` persiste diretamente as parcelas extraídas na cota, inclusive `parcela_reduzida_60`. A validação prévia só exige parcela positiva e abaixo de 25% do crédito, insuficiente para a inconsistência mostrada.

Esse desenho explica por que o primeiro crédito capturado em um contêiner pode receber valores indevidos. Não prova que a menor cota seja sempre o primeiro crédito do portal; isso requer o DOM real da execução e o snapshot persistido.

### Reprodução executada

`node scripts/diagnosticos/reproduzir-contaminacao-planos.mjs` extrai e executa o próprio bloco do robô em um documento simulado, sem rede ou banco. Três casos passaram:

- cartão isolado: par correto;
- contêiner com cabeçalho do crédito menor e outro plano: o extrator associa R$ 36.561,63 à parcela R$ 925,65 de outro crédito;
- contêiner com integral de um crédito e reduzida de 70% de outro: parcela integral R$ 589,05 é extraída também como Reduzida 70% do primeiro crédito.

Os números das fixtures são sintéticos e não representam registros consultados. A reprodução comprova o mecanismo, não a autoria histórica do dado das imagens.

## Outro risco independente

O mapa `mapDbGrupos` usa apenas os dígitos do código (`:78–80`). Os relatórios históricos das fases 141/142 documentam colisão de 5388 Veículo e Moto. A chave pode sobrescrever um grupo por outro. Deve ser auditada junto à administradora e ao tipo; não há evidência nesta fase de que causou o caso das imagens.

## Correção recomendada

1. Capturar somente cartões atômicos do grupo e tipo efetivamente selecionados, preferencialmente dados estruturados da resposta oficial quando disponíveis.
2. Validar grupo, crédito, modalidade da parcela e modalidade de transcorrido no mesmo registro; percentuais devem vir do rótulo da parcela.
3. Exigir consistência entre duplicatas da mesma chave e abortar importação conflitante antes de atualizar/inativar cotas.
4. Auditar todos os grupos, menor crédito e opção seguinte de cada Prorrogada/Diluída, usando a consulta de leitura preparada em `scripts/diagnosticos/auditar-menores-cotas.sql`. Flags são triagem e exigem conferência oficial; não autorizam recálculo em lote.
5. Recuperar somente parcelas comprovadamente erradas a partir das tabelas oficiais, preservando UUIDs e snapshots de vendas/contratações. Não substituir indiscriminadamente parcelas oficiais pela fórmula teórica.

## Conclusão e limites

Falhas do extrator e insuficiência do guard foram reproduzidas. O seletor resolve por UUID e a Soma do exemplo não está errada. A evidência aponta para a parcela-base persistida como origem imediata da primeira parcela alta. A confirmação do registro remoto, da execução importadora e da extensão por todos os grupos depende da liberação da consulta de leitura; nenhuma correção em produção foi realizada.
