# Cálculos de grupos/cotas

Fonte única: `gauchinho-app/src/lib/grupos/calculos.ts`

## Soma das cotas

- **Fórmula:** `Σ (valorCredito × quantidadeCotas)` por linha.
- **Campos:** `valorCredito`, `quantidadeCotas` (default 1).

## Saldo devedor

- **Fórmula:** por linha, `saldoDevedorInformado` se existir; senão `valorCredito`; multiplicado por quantidade.
- **TODO Excel:** confirmar se planilha usa saldo cadastrado ou crédito bruto.

## Lance embutido

- **Fórmula:** se `permiteLanceEmbutido`, `saldoDevedor × (percentualLanceEmbutido / 100)`.
- **TODO Excel:** base do percentual (saldo vs crédito).

## Recurso próprio

- **Fórmula:** `recursoProprioManual` se informado; senão `credito × (percentualRecursoProprioSugerido / 100)`.

## Lance total

- **Fórmula:** `lanceEmbutido + recursoProprio`.

## Primeira parcela

- **Fórmula:** soma de `valorParcelaInformado × quantidade` por linha.
- **TODO Excel:** parcela reduzida vs integral vs seguro embutido.

## Seguro

- **Fórmula:** se `seguroHabilitado`, `saldoDevedor × (seguroPercentual / 100)`.
- **TODO Excel:** base (saldo, crédito ou parcela).

## Parcelas restantes

- **Fórmula:** `prazoRestante` se definido; senão `max(prazoTotal − parcelasRealizadas, 0)`.

## Crédito líquido após contemplação

- **Fórmula:** `max(somaCotas − lanceTotal, 0)`.
- **TODO Excel:** ordem de abatimentos e seguro pós-contemplação.

## Totalizadores (`calcularTotaisGrupos`)

Agrega várias seleções (uma cota por grupo na UI pública), somando saldos, lances, seguro e usando o **máximo** de parcelas restantes entre grupos.

### Exemplo de entrada

- 1 cota, crédito R$ 100.000, parcela R$ 2.000.
- Grupo: lance embutido 10%, recurso próprio 5%, seguro 1% sobre saldo.

### Exemplo de saída (teste unitário)

| Campo | Valor |
|-------|-------|
| somaCotas | 100.000 |
| lanceEmbutido | 10.000 |
| recursoProprio | 5.000 |
| lanceTotal | 15.000 |
| creditoLiquido | 85.000 |
| primeiraParcela | 2.000 |
| seguro | 1.000 |

## Testes

`npm test` — arquivo `src/lib/grupos/calculos.test.ts`.
