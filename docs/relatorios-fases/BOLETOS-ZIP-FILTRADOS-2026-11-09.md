# Boletos: download em ZIP respeitando filtros

Data: 09/11/2026

## Objetivo

Permitir que a operação baixe de uma vez todos os PDFs de boleto disponíveis
na aba **Controle de Boletos**, mantendo exatamente os filtros já aplicados.

## Entrega

- Botão `Baixar N filtrado(s) (ZIP)` na área de resumo do controle de boletos.
- O ZIP inclui somente as linhas filtradas que já possuem PDF salvo.
- Cada PDF recebe nome determinístico com cliente, grupo, cota e competência
  selecionada, por exemplo: `CLIENTE_Grupo_1553_IMOVEL_Cota_0656_10-2026.pdf`.
- PDFs indisponíveis não impedem os demais downloads; o operador recebe a
  quantidade efetivamente incluída no ZIP.
- O download unitário passou a usar a mesma competência selecionada para o
  nome do arquivo.

## Segurança e limites

Os bytes de cada PDF continuam sendo obtidos pela rota autenticada já usada no
download unitário. Nenhuma URL de Storage é exposta adicionalmente e nenhuma
alteração estrutural ou migration foi necessária.

## Validação

- `npx tsc --noEmit`: aprovado.
- `npm exec vitest run src/lib/erp/robo-lances.test.ts`: 13 testes aprovados.
