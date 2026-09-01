# Fase 196 — Imposto automático nas comissões incrementais

## Diagnóstico

A configuração fiscal vigente de 17,5% era localizada pelo motor, porém novas
previsões podiam guardar a alíquota somente no snapshot da franqueadora. As
colunas fiscais usadas por **Minhas Comissões** permaneciam nulas e a previsão
do participante não recebia automaticamente o desconto. O lote da fase 170
também protegia a venda inteira quando apenas uma parcela já estava elegível;
por isso novas parcelas sem imposto da mesma venda não eram alcançadas.

## Correção

A migration 192 aplica a configuração fiscal no momento em que previsões da
franqueadora e do participante são inseridas. O participante recebe bruto,
alíquota, imposto e líquido no snapshot fiscal; `valor_previsto` passa a ser o
líquido. Na distribuição multicotas os fatos fiscais são proporcionalizados por
cota sem um segundo desconto.

O lote ganhou uma etapa incremental por linha. Ela alcança previsões reconhecidas
que ainda não possuem fato fiscal, inclusive quando outra parcela da venda já é
elegível. Previsões pagas, conferidas, canceladas ou vinculadas a item de
pagamento não são alteradas. Quando uma elegibilidade ainda não paga existe, ela
é reduzida pela mesma alíquota para permanecer compatível com o líquido.

A instalação reconcilia automaticamente as linhas pendentes conforme a
configuração vigente na data de cada venda e registra auditoria central. Repetir
o lote é idempotente: linhas que já possuem `fiscal_lote` são ignoradas.

