# Testes — cálculos do simulador de consórcio

Fonte única: `gauchinho-app/src/lib/simulador/consorcio.ts` e `projecao.ts`.

## Regras (simulação principal)

| Conceito | Fórmula |
|----------|---------|
| Taxa administrativa total | Crédito × taxa adm. % / 100 |
| Fundo de reserva total | Crédito × fundo % / 100 |
| **Saldo devedor estimado** | Crédito + taxa adm. total + fundo reserva total |
| Parcela integral | Saldo devedor estimado ÷ prazo (após lances, se houver) + seguro mensal |
| Parcela inicial escolhida | Parcela integral × (percentual da opção / 100) |
| **Total pago em 1 ano** | **Parcela inicial escolhida × 12** |
| Projeção ano N | Parcela do ano = parcela inicial × (1 + correção anual)^(N−1) |
| Total pago acumulado | Soma das parcelas pagas por ano (sem misturar lance no acumulado) |
| Crédito reajustado (ano N) | Crédito inicial × (1 + reajuste anual)^N |
| Ganho patrimonial estimado | Crédito reajustado − crédito inicial |
| Total estimado consórcio (comparativo) | Saldo devedor estimado |
| Custo adm. efetivo mensal | Taxa administrativa (%) ÷ prazo (meses) |
| Custo adm. efetivo anual | Custo mensal × 12 |

## Contemplação avançada (1º mês)

Fica em seção recolhível na UI e no PDF como “avançado”. **Não** altera o card “Total pago em 1 ano”.

- Saldo após 1º mês, parcela pós-contemplação e lances: `calcularContemplacaoPrimeiroMes`.

## Caso manual — R$ 1.000.000 (automático em `simulador.test.ts`)

| Campo | Valor |
|-------|--------|
| Taxa adm. | 22% → R$ 220.000 |
| Fundo reserva | 2% → R$ 20.000 |
| Saldo devedor estimado | **R$ 1.240.000** |
| Prazo | 220 meses |
| Parcela integral | 1.240.000 / 220 ≈ **R$ 5.636,36** |
| Parcela 60% | ≈ **R$ 3.381,82** |
| Total pago em 1 ano | 3.381,82 × 12 ≈ **R$ 40.581,84** |
| Crédito em 1 ano (6%) | **R$ 1.060.000** |
| Ganho patrimonial | **R$ 60.000** |
| Custo adm. efetivo | **0,10% a.m.** / **1,20% a.a.** |

## Opções de parcela (admin)

Em **Admin → Configurações → Simulador** (Imóvel / Automóvel):

- Até 5 opções com nome, percentual, descrição, ordem e ativa.
- **Uma opção ativa:** simulador usa automaticamente.
- **Várias ativas:** visitante escolhe um card.
- **Nenhuma configurada:** padrão parcela integral (100%).

## Comandos

```bash
cd gauchinho-app
npm test -- src/lib/simulador
npm run build
```

## UI

- Botões secundários no simulador: fundo escuro + texto claro (sem branco sobre branco).
- Cards principais **não** exibem saldo devedor inicial/final; saldo **estimado** no grid principal.
