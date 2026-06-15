import { describe, expect, it } from "vitest";
import { calcularParcelaConsorcio } from "./consorcio";
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
    });
    expect(r.taxaAdministrativaTotal).toBe(20_000);
    expect(r.fundoReservaTotal).toBe(2_000);
    expect(r.parcelaEstimada).toBeCloseTo(2033.33, 1);
    expect(r.valorTotalEstimado).toBeCloseTo(122_000, 0);
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
    });
    expect(linhas.length).toBeGreaterThanOrEqual(18);
    expect(linhas[0].ano).toBe(1);
    expect(linhas.find((l) => l.ano === 3)).toBeDefined();
  });
});
