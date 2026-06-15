# Testes — Simuladores Fase 2

**Data:** 15/06/2026  
**Comando:** `cd gauchinho-app && npm test`

## Consórcio — automóvel (caso documentado)

| Parâmetro | Valor |
|-----------|-------|
| Crédito | R$ 100.000 |
| Prazo | 60 meses |
| Taxa adm | 20% |
| Fundo reserva | 2% |
| Seguro | 0% |
| Reajuste crédito / parcela | 8% a.a. |

**Resultados esperados (Vitest):**

- Taxa adm total: R$ 20.000  
- Fundo reserva: R$ 2.000  
- Parcela estimada: ≈ R$ 2.033,33  
- Total estimado: ≈ R$ 122.000  

Fórmula parcela: `(crédito + adm + fundo) / prazo` (sem seguro).

## Imóvel — projeção

| Parâmetro | Valor |
|-----------|-------|
| Crédito | R$ 1.000.000 |
| Prazo | 220 meses |
| Taxa adm | 22% |
| Fundo | 2% |
| Seguro | 0,038% a.a. |
| Reajuste / correção | 8% a.a. |

**Validação:** `gerarProjecaoAnoAno` produz ≥ 18 linhas; anos 1, 3, 5, 10 presentes na tabela completa da UI.

Parcela imóvel (aprox.): base `(1.000.000 + 220.000 + 20.000) / 220` + seguro mensal.

## Financiamento

| Parâmetro | Valor |
|-----------|-------|
| Valor do bem | R$ 500.000 |
| Entrada | R$ 100.000 |
| Taxa mensal | 1% |
| Prazo | 240 meses |

**Resultados (Vitest):**

- Valor financiado: R$ 400.000  
- Parcela: > R$ 3.000 (Price)  
- Juros totais: > 0  
- Custo final: > R$ 500.000  

## Comparativo

Mesmo crédito/prazo: parcela financiamento > parcela consórcio no caso de teste (`comparativo.test`).

## Teste manual pendente

- [ ] `/simulador` — simular sem cadastro  
- [ ] Captura lead `simulador_consorcio` / `simulador_financiamento`  
- [ ] Proposta básica no admin  
- [ ] WhatsApp por origem após lead  
- [ ] Regressão `/grupos`

## Arquivos de cálculo

- `src/lib/simulador/consorcio.ts`
- `src/lib/simulador/financiamento.ts`
- `src/lib/simulador/projecao.ts`
- `src/lib/simulador/comparativo.ts`
