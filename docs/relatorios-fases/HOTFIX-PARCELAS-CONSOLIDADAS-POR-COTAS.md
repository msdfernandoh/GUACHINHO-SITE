# Hotfix — parcelas consolidadas pela quantidade de cotas

## Problema

O crédito contratado e a primeira parcela já eram apresentados como totais da
seleção, mas os campos “Parcela integral” e “Parcela reduzida” permaneciam com
o valor de uma única cota. Em propostas com duas ou quatro cotas, a combinação
de valores unitários e totais no mesmo resumo causava interpretação incorreta.

Além disso, a parcela reduzida não identificava o percentual aplicado, como
60% da parcela integral.

## Causa

O cálculo de cada linha preserva corretamente as parcelas unitárias para a tela
de escolha do grupo. Ao produzir os totais do snapshot, porém, o agregador
somava uma vez cada parcela sem multiplicá-la por `quantidadeCotas`.

## Correção

- `parcelaIntegralTotal` passa a somar parcela unitária × quantidade de cotas;
- `parcelaReduzidaTotal` aplica a mesma consolidação, inclusive à modalidade
  personalizada;
- a leitura de snapshots antigos recalcula os dois totais a partir das linhas e
  quantidades persistidas, antes de usar o total legado incorreto;
- proposta pública e detalhe administrativo exibem o percentual quando todas
  as linhas possuem o mesmo percentual, por exemplo “Parcela reduzida (60%)”.

Não houve migration, recálculo ou alteração dos fatos persistidos. A correção é
compatível com propostas/contratações existentes e com novos snapshots.

## Validação

- regressão de quatro cotas: R$ 1.346,20 integral unitária resulta em
  R$ 5.384,80; R$ 807,72 reduzida unitária resulta em R$ 3.230,88;
- percentual derivado e exibido: 60%;
- 199 arquivos e 1.071 testes aprovados; 9 arquivos e 37 testes ignorados pela
  configuração existente;
- ESLint direcionado sem erros; três avisos preexistentes foram mantidos.
