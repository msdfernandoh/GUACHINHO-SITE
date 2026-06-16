# Testes — cálculos do simulador de consórcio

Fonte única: `gauchinho-app/src/lib/simulador/consorcio.ts` e `projecao.ts`.

## Regras

| Conceito | Fórmula |
|----------|---------|
| Parcela exibida | Parcela integral × (percentual da opção / 100) |
| Total pago acumulado | Soma de (parcela do ano × meses pagos no ano), **sem** somar lance no acumulado |
| Crédito reajustado (ano N) | Crédito inicial × (1 + reajuste anual)^N |
| Ganho patrimonial estimado | Crédito reajustado − crédito inicial |
| Saldo devedor inicial | Parcela integral × prazo + lance próprio + lance embutido |
| Saldo devedor final | Saldo inicial − primeira parcela − lances (contemplação mês 1) |
| Parcela pós-contemplação | Saldo final ÷ (prazo − 1) |
| Custo adm. efetivo mensal | Taxa administrativa (%) ÷ prazo (meses) |
| Custo adm. efetivo anual | Custo mensal × 12 |
| Total pago ano 1 (contemplação) | Primeira parcela + 11 × parcela pós-contemplação |

## Contemplação no 1º mês

Simulação comercial: cliente paga a 1ª parcela, aplica lances e passa a pagar parcela pós-contemplação nas restantes.

Exemplo (automático em `simulador.test.ts` — `contemplação no 1º mês`):

- Crédito R$ 500.000, prazo 220, taxa adm. 22%, parcela 50%, lances R$ 25.000 + R$ 50.000  
- Custo adm. efetivo: **0,10% a.m.** / **1,20% a.a.**  
- Total pago em 1 ano: **primeira parcela + 11 × parcela pós-contemplação**  
- Ganho patrimonial ano 1: **R$ 30.000,00** (6% sobre o crédito)

## Caso 1 — Projeção com contemplação

Entrada:

- Crédito: R$ 500.000,00  
- Prazo: 220 meses  
- Taxa adm.: 22%, fundo: 2%, seguro: 0,038% a.a.  
- Opção de parcela: **60%** da integral (exemplo com taxas padrão imóvel)  
- Reajuste anual do crédito: **6%**  
- Correção anual da parcela: **0%** no 1º ano  

Resultado esperado (ano 1):

- Total pago: **primeira parcela + 11 × parcela pós-contemplação**
- Crédito estimado em 1 ano: **R$ 530.000,00**  
- Ganho patrimonial estimado: **R$ 30.000,00**  

Automatizado em `simulador.test.ts` (`caso 1`).

## Caso 2 — Com correção anual da parcela

Mesma base do caso 1, correção anual da parcela **8%**.

Ano 1 (parcela **P**):

- Total pago acumulado: **P × 12**  

Ano 2 (correção 8%):

- Parcela: **P × 1,08**  
- Total pago acumulado: **(P × 12) + (P × 1,08 × 12)**  

Exemplo numérico se **P = R$ 1.246,55**:

- Ano 1 total: R$ 14.958,60  
- Ano 2 parcela: R$ 1.346,27  
- Ano 2 total acumulado: R$ 31.113,84  

Automatizado em `simulador.test.ts` (`caso 2`).

## Opções de parcela (admin)

Em **Admin → Configurações → Simulador** (Imóvel / Automóvel):

- Até 5 opções com nome, percentual, descrição, ordem e ativa.  
- **Uma opção ativa:** simulador usa automaticamente.  
- **Várias ativas:** visitante escolhe um card.  
- **Nenhuma configurada:** padrão parcela integral (100%).

## Comandos

```bash
cd gauchinho-app
npm test
npm run build
```

## Checklist manual

- [ ] Parcela do resultado = parcela na tabela (ano 1)  
- [ ] Total pago 1 ano = parcela × 12  
- [ ] Ganho patrimonial = crédito reajustado − crédito inicial  
- [ ] Trocar opção de parcela recalcula cards e tabela  
- [ ] PDF da proposta reflete os mesmos marcos de projeção  
