import { describe, expect, it } from "vitest";
import { obterQuantidadeCotasContratacao } from "./quantidade-cotas";

describe("obterQuantidadeCotasContratacao", () => {
  it("prioriza a quantidade explícita do snapshot sobre o default legado da coluna", () => {
    expect(obterQuantidadeCotasContratacao({ totais: { totalCotas: 2 } }, 1)).toBe(2);
  });

  it("usa a coluna persistida quando o snapshot antigo não informa quantidade", () => {
    expect(obterQuantidadeCotasContratacao({}, 4)).toBe(4);
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
