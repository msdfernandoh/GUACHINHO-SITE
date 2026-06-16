import { describe, expect, it } from "vitest";
import { calcularAplicacaoMensal } from "./aplicacao";
import { calcularValorFuturo } from "./valor-futuro";
import { calcularFinanciamentoCalculadora } from "./financiamento-calc";
import { calcularCorrecaoValores, taxaMensalFromInput } from "./correcao";

describe("calcularAplicacaoMensal", () => {
  it("taxa zero", () => {
    const r = calcularAplicacaoMensal({
      valorInicial: 1000,
      aporteMensal: 100,
      taxaMensalPercentual: 0,
      prazoMeses: 12,
    });
    expect(r.valorFuturo).toBe(2200);
    expect(r.totalInvestido).toBe(2200);
    expect(r.rendimentoEstimado).toBe(0);
  });

  it("taxa positiva", () => {
    const r = calcularAplicacaoMensal({
      valorInicial: 0,
      aporteMensal: 100,
      taxaMensalPercentual: 1,
      prazoMeses: 2,
    });
    expect(r.valorFuturo).toBeGreaterThan(200);
  });
});

describe("calcularValorFuturo", () => {
  it("composto básico", () => {
    const r = calcularValorFuturo({
      valorInicial: 1000,
      taxaMensalPercentual: 1,
      prazoMeses: 12,
    });
    expect(r.valorFuturo).toBeGreaterThan(1000);
  });
});

describe("calcularFinanciamentoCalculadora", () => {
  it("Price", () => {
    const r = calcularFinanciamentoCalculadora({
      valorBem: 100_000,
      entrada: 20_000,
      taxaMensalPercentual: 1,
      prazoMeses: 12,
    });
    expect(r.parcelaEstimada).toBeGreaterThan(0);
    expect(r.valorFinanciado).toBe(80_000);
  });

  it("taxa zero", () => {
    const r = calcularFinanciamentoCalculadora({
      valorBem: 120_000,
      entrada: 0,
      taxaMensalPercentual: 0,
      prazoMeses: 12,
    });
    expect(r.parcelaEstimada).toBe(10_000);
  });
});

describe("calcularCorrecaoValores", () => {
  it("taxa mensal", () => {
    const r = calcularCorrecaoValores({
      valorInicial: 1000,
      percentualTaxa: 1,
      tipoTaxa: "mensal",
      prazoMeses: 12,
    });
    expect(r.valorCorrigido).toBeGreaterThan(1000);
  });

  it("taxa anual convertida", () => {
    const mensal = taxaMensalFromInput(12, "anual");
    expect(mensal).toBeGreaterThan(0);
    expect(mensal).toBeLessThan(0.12);
    const r = calcularCorrecaoValores({
      valorInicial: 1000,
      percentualTaxa: 12,
      tipoTaxa: "anual",
      prazoMeses: 12,
    });
    expect(r.valorCorrigido).toBeGreaterThan(1000);
  });
});
