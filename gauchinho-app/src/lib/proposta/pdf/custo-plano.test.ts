import { describe, expect, it } from "vitest";
import { calcularCustoDiluido, fmtPercent } from "./custo-plano";

describe("custo do plano diluído", () => {
  it("dilui taxa + fundo de reserva no prazo (exemplo imóvel 220 meses)", () => {
    const r = calcularCustoDiluido(20, 2, 220);
    expect(r.basePercentual).toBe(22);
    expect(r.percentualMes).toBeCloseTo(0.1, 4);
    expect(r.percentualAno).toBeCloseTo(1.2, 4);
  });

  it("dilui no prazo curto (exemplo veículo 80 meses)", () => {
    const r = calcularCustoDiluido(15, 1, 80);
    expect(r.basePercentual).toBe(16);
    expect(r.percentualMes).toBeCloseTo(0.2, 4);
    expect(r.percentualAno).toBeCloseTo(2.4, 4);
  });

  it("não divide por zero quando o prazo é ausente", () => {
    const r = calcularCustoDiluido(20, 2, 0);
    expect(r.basePercentual).toBe(22);
    expect(r.percentualMes).toBe(0);
    expect(r.percentualAno).toBe(0);
  });

  it("trata entradas nulas como zero", () => {
    const r = calcularCustoDiluido(null, undefined, null);
    expect(r).toEqual({ basePercentual: 0, percentualMes: 0, percentualAno: 0 });
  });

  it("formata o percentual em pt-BR", () => {
    expect(fmtPercent(0.1)).toBe("0,10%");
    expect(fmtPercent(1.2)).toBe("1,20%");
    expect(fmtPercent(null)).toBe("—");
  });
});
