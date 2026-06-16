import { describe, expect, it } from "vitest";
import {
  calcularContemplacaoPrimeiroMes,
  calcularParcelaConsorcio,
  calcularParcelaReduzida,
  calcularProjecaoConsorcio,
  calcularTotalPagoPrimeiroAnoAposContemplacao,
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
    expect(r.parcelaIntegral).toBeCloseTo(2033.33, 1);
    expect(r.parcelaEstimada).toBeCloseTo(2033.33, 1);
    expect(r.valorTotalEstimado).toBeCloseTo(122_000, 0);
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
    expect(c.financiamento.parcelaEstimada).toBeGreaterThan(c.consorcio.parcelaEstimada);
  });

  it("projeção imóvel 1M / 220 meses gera linhas", () => {
    const linhas = gerarProjecaoAnoAno({
      valorCredito: 1_000_000,
      prazoMeses: 220,
      taxaAdministrativaPercentual: 22,
      fundoReservaPercentual: 2,
      seguroPrestamistaPercentual: 0.038,
      reajusteAnualCredito: 8,
      correcaoAnualParcela: 8,
      percentualParcelaInicial: 100,
    });
    expect(linhas.length).toBeGreaterThanOrEqual(18);
    expect(linhas[0].ano).toBe(1);
    expect(linhas.find((l) => l.ano === 3)).toBeDefined();
  });

  it("caso 1 — projeção ano 1 com contemplação no 1º mês", () => {
    const entrada = {
      valorCredito: 500_000,
      prazoMeses: 220,
      taxaAdministrativaPercentual: 22,
      fundoReservaPercentual: 2,
      seguroPrestamistaPercentual: 0.038,
      percentualParcelaInicial: 60,
      reajusteAnualCredito: 6,
      correcaoAnualParcela: 0,
    };
    const c = calcularContemplacaoPrimeiroMes(entrada);
    const [y1] = calcularProjecaoConsorcio(entrada);
    const totalAno1 = calcularTotalPagoPrimeiroAnoAposContemplacao(
      c.primeiraParcela,
      c.parcelaPosContemplacao,
    );
    expect(y1.totalPagoAcumulado).toBeCloseTo(totalAno1, 0);
    expect(y1.creditoEstimadoReajustado).toBeCloseTo(530_000, 0);
    expect(y1.ganhoPatrimonialEstimado).toBeCloseTo(30_000, 0);
  });

  it("caso 2 — correção anual sobre parcela pós-contemplação", () => {
    const entrada = {
      valorCredito: 500_000,
      prazoMeses: 220,
      taxaAdministrativaPercentual: 22,
      fundoReservaPercentual: 2,
      seguroPrestamistaPercentual: 0.038,
      percentualParcelaInicial: 60,
      reajusteAnualCredito: 6,
      correcaoAnualParcela: 8,
    };
    const c = calcularContemplacaoPrimeiroMes(entrada);
    const linhas = calcularProjecaoConsorcio(entrada);
    const y1 = linhas[0];
    const y2 = linhas[1];
    expect(y1.totalPagoAcumulado).toBeCloseTo(
      calcularTotalPagoPrimeiroAnoAposContemplacao(c.primeiraParcela, c.parcelaPosContemplacao),
      0,
    );
    expect(y2.parcelaEstimadaNoPeriodo).toBeCloseTo(c.parcelaPosContemplacao * 1.08, 1);
    expect(y2.totalPagoAcumulado).toBeCloseTo(
      y1.totalPagoAcumulado + y2.parcelaEstimadaNoPeriodo * 12,
      0,
    );
  });

  it("contemplação no 1º mês — lances e custo adm. efetivo", () => {
    const entrada = {
      valorCredito: 500_000,
      prazoMeses: 220,
      taxaAdministrativaPercentual: 22,
      fundoReservaPercentual: 2,
      seguroPrestamistaPercentual: 0.038,
      percentualParcelaInicial: 50,
      entrada: 25_000,
      lanceEmbutido: 50_000,
      reajusteAnualCredito: 6,
      correcaoAnualParcela: 0,
    };
    const c = calcularContemplacaoPrimeiroMes(entrada);
    expect(c.lanceTotal).toBe(75_000);
    expect(c.parcelasRestantes).toBe(219);
    expect(c.custoAdmEfetivoMensalPercentual).toBeCloseTo(0.1, 2);
    expect(c.custoAdmEfetivoAnualPercentual).toBeCloseTo(1.2, 2);
    expect(c.saldoDevedorFinal).toBeCloseTo(
      c.saldoDevedorInicial - c.primeiraParcela - 25_000 - 50_000,
      0,
    );
    expect(c.parcelaPosContemplacao).toBeCloseTo(c.saldoDevedorFinal / 219, 0);
    const [y1] = calcularProjecaoConsorcio(entrada);
    expect(y1.totalPagoAcumulado).toBeCloseTo(
      c.primeiraParcela + c.parcelaPosContemplacao * 11,
      0,
    );
    expect(y1.ganhoPatrimonialEstimado).toBeCloseTo(30_000, 0);
  });
});
