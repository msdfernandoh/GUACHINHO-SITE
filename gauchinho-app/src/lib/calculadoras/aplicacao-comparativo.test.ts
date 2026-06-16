import { describe, expect, it } from "vitest";
import { calcularAplicacaoComparativo, taxaCdiEfetivaAnual } from "./aplicacao-comparativo";

describe("calcularAplicacaoComparativo", () => {
  it("taxa zero", () => {
    const r = calcularAplicacaoComparativo({
      valorInicial: 1000,
      aporteMensal: 100,
      prazoMeses: 12,
      perfil: "taxa_manual",
      percentualCdi: 100,
      taxasPorPerfil: { taxa_manual: 0 },
    });
    expect(r.valorFinalEstimado).toBe(2200);
    expect(r.rendimentoEstimado).toBe(0);
  });

  it("CDI 100% vs 110%", () => {
    const base = calcularAplicacaoComparativo({
      valorInicial: 0,
      aporteMensal: 100,
      prazoMeses: 24,
      perfil: "cdi",
      percentualCdi: 100,
      taxasPorPerfil: { cdi: 0.8 },
    });
    const maior = calcularAplicacaoComparativo({
      valorInicial: 0,
      aporteMensal: 100,
      prazoMeses: 24,
      perfil: "cdi",
      percentualCdi: 110,
      taxasPorPerfil: { cdi: 0.88 },
    });
    expect(maior.valorFinalEstimado).toBeGreaterThan(base.valorFinalEstimado);
  });

  it("comparativo entre opções", () => {
    const r = calcularAplicacaoComparativo({
      valorInicial: 1000,
      aporteMensal: 0,
      prazoMeses: 12,
      perfil: "comparar_todos",
      percentualCdi: 100,
      taxasPorPerfil: {
        poupanca: 0.5,
        cdi: 0.8,
        tesouro_selic: 0.75,
        tesouro_ipca: 0.6,
        taxa_manual: 0.4,
      },
    });
    expect(r.comparativo.length).toBe(5);
    expect(r.melhorResultadoEstimado).toBe("cdi");
  });
});

describe("taxaCdiEfetivaAnual", () => {
  it("110% do CDI", () => {
    expect(taxaCdiEfetivaAnual(10, 110)).toBe(11);
  });
});
