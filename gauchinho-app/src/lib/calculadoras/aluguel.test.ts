import { describe, expect, it } from "vitest";
import { calcularCorrecaoAluguel } from "./aluguel";

describe("calcularCorrecaoAluguel", () => {
  it("IPCA 12 meses", () => {
    const r = calcularCorrecaoAluguel({
      valorAtual: 2000,
      indice: "ipca",
      usarIndiceAtual: true,
      percentualManual: 0,
      percentualIndice: 5,
      periodoMeses: 12,
    });
    expect(r.novoValor).toBe(2100);
    expect(r.valorReajuste).toBe(100);
    expect(r.diferencaAnual).toBe(1200);
  });

  it("IGP-M", () => {
    const r = calcularCorrecaoAluguel({
      valorAtual: 1000,
      indice: "igpm",
      usarIndiceAtual: true,
      percentualManual: 0,
      percentualIndice: 3.8,
      periodoMeses: 12,
    });
    expect(r.novoValor).toBe(1038);
  });

  it("taxa manual", () => {
    const r = calcularCorrecaoAluguel({
      valorAtual: 2000,
      indice: "taxa_manual",
      usarIndiceAtual: false,
      percentualManual: 4,
      percentualIndice: null,
      periodoMeses: 12,
    });
    expect(r.percentualAplicado).toBe(4);
    expect(r.novoValor).toBe(2080);
  });
});
