import { describe, expect, it } from "vitest";
import { calcularTaxaRealFinanciamento, calcularTaxaRealDoBem } from "./juros-real";

describe("calcularTaxaRealFinanciamento", () => {
  it("estima taxa positiva para parcela com juros", () => {
    const r = calcularTaxaRealFinanciamento({
      valorFinanciado: 100_000,
      parcela: 2_500,
      prazoMeses: 60,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.taxaMensalPercentual).toBeGreaterThan(0);
      expect(r.taxaAnualPercentual).toBeGreaterThan(0);
      expect(r.totalPago).toBe(150_000);
      expect(r.jurosTotais).toBe(50_000);
      expect(Number.isFinite(r.taxaMensalPercentual)).toBe(true);
    }
  });

  it("rejeita parcela insuficiente", () => {
    const r = calcularTaxaRealFinanciamento({
      valorFinanciado: 100_000,
      parcela: 800,
      prazoMeses: 120,
    });
    expect(r.ok).toBe(false);
  });

  it("rejeita valores vazios", () => {
    const r = calcularTaxaRealFinanciamento({
      valorFinanciado: 0,
      parcela: 100,
      prazoMeses: 12,
    });
    expect(r.ok).toBe(false);
  });

  it("calcularTaxaRealDoBem desconta entrada", () => {
    const r = calcularTaxaRealDoBem(120_000, 20_000, 2_500, 60);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valorFinanciado).toBe(100_000);
    }
  });
});
