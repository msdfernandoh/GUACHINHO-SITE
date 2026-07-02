import { describe, expect, it } from "vitest";
import { estimarCreditoConsorcioPorParcela, projetarCreditoReajustado, parcelaReduzidaComparacaoAplicacao } from "./estimar-credito-por-parcela";

describe("estimarCreditoConsorcioPorParcela", () => {
  it("aproxima crédito ~146k para parcela 500 em 220 meses", () => {
    const r = estimarCreditoConsorcioPorParcela({
      parcelaDesejada: 500,
      prazoMeses: 220,
      percentualParcelaReduzida: 60,
      taxaAdministrativaPercentual: 22,
      fundoReservaPercentual: 2,
      seguroPrestamistaPercentual: 0.038,
    });
    expect(r).not.toBeNull();
    expect(r!.creditoContratadoEstimado).toBeGreaterThan(130_000);
    expect(r!.creditoContratadoEstimado).toBeLessThan(165_000);
    expect(r!.parcelaReduzida).toBeCloseTo(500, 0);
    expect(r!.parcelaIntegral).toBeCloseTo(830, -1);
    expect(r!.parcelaIntegral).toBeGreaterThan(r!.parcelaReduzida);
    expect(r!.saldoDevedorEstimado).toBeGreaterThan(r!.creditoContratadoEstimado);
  });

  it("não usa parcela integral como alvo quando reduzida é 60%", () => {
    const base = {
      parcelaDesejada: 500,
      prazoMeses: 220,
      taxaAdministrativaPercentual: 22,
      fundoReservaPercentual: 2,
      seguroPrestamistaPercentual: 0.038,
    };
    const reduzida = estimarCreditoConsorcioPorParcela({ ...base, percentualParcelaReduzida: 60 })!;
    const integralAlvo = estimarCreditoConsorcioPorParcela({ ...base, percentualParcelaReduzida: 100 })!;
    expect(reduzida.creditoContratadoEstimado).toBeGreaterThan(integralAlvo.creditoContratadoEstimado * 1.5);
    expect(parcelaReduzidaComparacaoAplicacao(reduzida.creditoContratadoEstimado, {
      ...base,
      percentualParcelaReduzida: 60,
    })).toBeCloseTo(500, 0);
  });
});

describe("projetarCreditoReajustado", () => {
  it("reajusta crédito em 10 anos a 6% a.a.", () => {
    const v = projetarCreditoReajustado(146_000, 6, 120);
    expect(v).toBeCloseTo(261_463.76, -1);
  });
});
