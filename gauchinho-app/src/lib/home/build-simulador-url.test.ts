import { describe, expect, it } from "vitest";
import { buildSimuladorUrl } from "./build-simulador-url";

describe("buildSimuladorUrl", () => {
  it("monta URL com tipo, solucao, valor e prazo", () => {
    const url = buildSimuladorUrl({
      tipo: "imovel",
      solucao: "consorcio",
      valor: 350_000,
      prazo: 180,
    });
    expect(url).toContain("/simulador?");
    expect(url).toContain("tipo=imovel");
    expect(url).toContain("solucao=consorcio");
    expect(url).toContain("valor=350000");
    expect(url).toContain("prazo=180");
  });

  it("financiamento sem tipo", () => {
    expect(buildSimuladorUrl({ solucao: "financiamento" })).toBe(
      "/simulador?solucao=financiamento",
    );
  });

  it("sem params retorna /simulador", () => {
    expect(buildSimuladorUrl({})).toBe("/simulador");
  });
});
