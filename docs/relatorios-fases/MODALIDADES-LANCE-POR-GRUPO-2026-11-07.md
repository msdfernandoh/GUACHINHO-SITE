# Modalidades de lance exibidas por grupo — 07/11/2026

## Correção

A tela `/erp/lances` passa a renderizar os campos de configuração somente para as modalidades ativas cadastradas em `grupos_modalidades_lance` do grupo da cota. Quando o grupo não possui cadastro de modalidades, o comportamento seguro continua sendo exibir apenas Lance Livre.

No grupo 5388, uma modalidade Fidelidade não cadastrada não será mais exibida, nem poderá ser marcada. A validação do servidor permanece alinhada à mesma lista de modalidades do grupo, impedindo que a cota seja salva com uma modalidade incompatível.

## Validação

TypeScript passou após a alteração. A tela e o servidor usam a mesma classificação de modalidade (`LIVRE`, `FIXO`, `SEGUNDO_FIXO`, `FIDELIDADE`), preservando os percentuais e limites de embutido individuais do grupo.
