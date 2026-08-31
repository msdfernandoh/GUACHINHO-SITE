import { describe, expect, it } from "vitest";
import { obterQuantidadeCotasContratacao } from "./quantidade-cotas";

describe("obterQuantidadeCotasContratacao", () => {
  it("prioriza a coluna persistida", () => {
    expect(obterQuantidadeCotasContratacao({ totais: { totalCotas: 2 } }, 4)).toBe(4);
  });

  it("lê a quantidade congelada na seleção do simulador", () => {
    expect(obterQuantidadeCotasContratacao({
      selecoes: [{ config: { quantidadeCotas: 4 } }],
      totais: { totalCotas: 4 },
    })).toBe(4);
  });

  it("mantém fallback seguro para snapshots antigos", () => {
    expect(obterQuantidadeCotasContratacao({})).toBe(1);
    expect(obterQuantidadeCotasContratacao({ totais: { totalCotas: 0 } })).toBe(1);
  });
});
