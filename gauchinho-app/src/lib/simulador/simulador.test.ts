import { describe, expect, it } from "vitest";
import {
  calcularContemplacaoPrimeiroMes,
  calcularParcelaConsorcio,
  calcularParcelaReduzida,
  calcularProjecaoConsorcio,
} from "./consorcio";
import { simularFinanciamento } from "./financiamento";
import { compararConsorcioFinanciamento } from "./comparativo";
import { gerarProjecaoAnoAno } from "./projecao";

describe("simulador consórcio — caso Fase 2", () => {
  it("R$ 100k, 60 meses, adm 20%, fundo 2%, seguro 0%", () => {
    const r = calcularParcelaConsorcio({
      valorCredito: 100_000,
      prazoMeses: 60,
      taxaAdministrativaPercentual: 20,
      fundoReservaPercentual: 2,
      seguroPrestamistaPercentual: 0,
      reajusteAnualCredito: 8,
      correcaoAnualParcela: 8,
      percentualParcelaInicial: 100,
    });
    expect(r.taxaAdministrativaTotal).toBe(20_000);
    expect(r.fundoReservaTotal).toBe(2_000);
    expect(r.saldoDevedorEstimado).toBe(122_000);
    expect(r.parcelaIntegral).toBeCloseTo(2033.33, 1);
    expect(r.parcelaEstimada).toBeCloseTo(2033.33, 1);
    expect(r.valorTotalEstimado).toBe(122_000);
  });

  it("parcela reduzida aplica percentual sobre a integral", () => {
    const integral = 2000;
    expect(calcularParcelaReduzida(integral, 60)).toBeCloseTo(1200, 2);
  });
});

describe("simulador financiamento — caso Fase 2", () => {
  it("R$ 500k bem, entrada 100k, 1% a.m., 240 meses", () => {
    const r = simularFinanciamento({
      valorBem: 500_000,
      entrada: 100_000,
      taxaMensalPercentual: 1,
      prazoMeses: 240,
    });
    expect(r.valorFinanciado).toBe(400_000);
    expect(r.parcelaEstimada).toBeGreaterThan(3000);
    expect(r.jurosTotais).toBeGreaterThan(0);
    expect(r.custoFinal).toBeGreaterThan(500_000);
  });
});

describe("comparativo e projeção", () => {
  it("comparativo retorna diferenças", () => {
    const c = compararConsorcioFinanciamento(
      {
        valorCredito: 100_000,
        prazoMeses: 60,
        taxaAdministrativaPercentual: 20,
        fundoReservaPercentual: 2,
        seguroPrestamistaPercentual: 0,
        percentualParcelaInicial: 100,
      },
      {
        valorBem: 100_000,
        entrada: 0,
        taxaMensalPercentual: 1,
        prazoMeses: 60,
      },
    );
    expect(c.diferencaParcela).toBeDefined();
    expect(c.consorcio.valorTotalEstimado).toBe(122_000);
    expect(c.financiamento.parcelaEstimada).toBeGreaterThan(c.consorcio.parcelaEstimada);
  });

  it("projeção imóvel 1M / 220 meses gera linhas", () => {
    const linhas = gerarProjecaoAnoAno({
      valorCredito: 1_000_000,
      prazoMeses: 220,
      taxaAdministrativaPercentual: 22,
      fundoReservaPercentual: 2,
      seguroPrestamistaPercentual: 0,
      reajusteAnualCredito: 8,
      correcaoAnualParcela: 8,
      percentualParcelaInicial: 100,
    });
    expect(linhas.length).toBeGreaterThanOrEqual(18);
    expect(linhas[0].ano).toBe(1);
  });

  it("caso manual — 1M, 22% adm, 2% fundo, 220m, 60% parcela, 6% reajuste", () => {
    const entrada = {
      valorCredito: 1_000_000,
      prazoMeses: 220,
      taxaAdministrativaPercentual: 22,
      fundoReservaPercentual: 2,
      seguroPrestamistaPercentual: 0,
      percentualParcelaInicial: 60,
      reajusteAnualCredito: 6,
      correcaoAnualParcela: 0,
    };
    const base = calcularParcelaConsorcio(entrada);
    expect(base.taxaAdministrativaTotal).toBe(220_000);
    expect(base.fundoReservaTotal).toBe(20_000);
    expect(base.saldoDevedorEstimado).toBe(1_240_000);
    expect(base.parcelaIntegral).toBeCloseTo(5636.36, 1);
    expect(base.parcelaEstimada).toBeCloseTo(3381.82, 1);

    const [y1] = calcularProjecaoConsorcio(entrada);
    expect(y1.totalPagoAcumulado).toBeCloseTo(base.parcelaEstimada * 12, 0);
    expect(y1.parcelaEstimadaNoPeriodo).toBeCloseTo(base.parcelaEstimada, 1);
    expect(y1.creditoEstimadoReajustado).toBeCloseTo(1_060_000, 0);
    expect(y1.ganhoPatrimonialEstimado).toBeCloseTo(60_000, 0);

    const c = calcularContemplacaoPrimeiroMes(entrada);
    expect(c.custoAdmEfetivoMensalPercentual).toBeCloseTo(0.1, 2);
    expect(c.custoAdmEfetivoAnualPercentual).toBeCloseTo(1.2, 2);
  });

  it("projeção ano 1 usa parcela escolhida, não pós-contemplação", () => {
    const entrada = {
      valorCredito: 500_000,
      prazoMeses: 220,
      taxaAdministrativaPercentual: 22,
      fundoReservaPercentual: 2,
      seguroPrestamistaPercentual: 0,
      percentualParcelaInicial: 60,
      reajusteAnualCredito: 6,
      correcaoAnualParcela: 0,
    };
    const base = calcularParcelaConsorcio(entrada);
    const [y1] = calcularProjecaoConsorcio(entrada);
    expect(y1.totalPagoAcumulado).toBeCloseTo(base.parcelaEstimada * 12, 0);
    expect(y1.ganhoPatrimonialEstimado).toBeCloseTo(30_000, 0);
  });

  it("correção anual sobre parcela escolhida a partir do ano 2", () => {
    const entrada = {
      valorCredito: 500_000,
      prazoMeses: 220,
      taxaAdministrativaPercentual: 22,
      fundoReservaPercentual: 2,
      seguroPrestamistaPercentual: 0,
      percentualParcelaInicial: 60,
      reajusteAnualCredito: 6,
      correcaoAnualParcela: 8,
    };
    const base = calcularParcelaConsorcio(entrada);
    const linhas = calcularProjecaoConsorcio(entrada);
    const y1 = linhas[0];
    const y2 = linhas[1];
    expect(y1.parcelaEstimadaNoPeriodo).toBeCloseTo(base.parcelaEstimada, 1);
    expect(y2.parcelaEstimadaNoPeriodo).toBeCloseTo(base.parcelaEstimada * 1.08, 1);
    expect(y2.totalPagoAcumulado).toBeCloseTo(
      y1.totalPagoAcumulado + y2.parcelaEstimadaNoPeriodo * 12,
      0,
    );
  });

  it("contemplação avançada — lances e parcela pós-contemplação", () => {
    const entrada = {
      valorCredito: 500_000,
      prazoMeses: 220,
      taxaAdministrativaPercentual: 22,
      fundoReservaPercentual: 2,
      seguroPrestamistaPercentual: 0,
      percentualParcelaInicial: 50,
      entrada: 25_000,
      lanceEmbutido: 50_000,
      reajusteAnualCredito: 6,
      correcaoAnualParcela: 0,
    };
    const c = calcularContemplacaoPrimeiroMes(entrada);
    expect(c.lanceTotal).toBe(75_000);
    expect(c.parcelasRestantes).toBe(219);
    expect(c.saldoDevedorInicial).toBe(c.saldoDevedorEstimado);
    expect(c.parcelaPosContemplacao).toBeCloseTo(c.saldoDevedorFinal / 219, 0);
    const [y1] = calcularProjecaoConsorcio(entrada);
    expect(y1.totalPagoAcumulado).toBeCloseTo(c.parcelaEstimada * 12, 0);
  });
});
