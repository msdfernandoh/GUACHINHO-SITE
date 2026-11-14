import { describe, expect, it } from "vitest";
import { projecaoAno, tabelaProjecao } from "./projecao";

describe("projeção da carta de R$ 100 mil em 16 anos", () => {
  it("reproduz a tabela comercial", () => {
    expect(projecaoAno(1)).toEqual({ ano: 1, parcelaMensal: 375, creditoNoAno: 100_000, creditoNoFim: 599_580.2 });
    expect(projecaoAno(2)).toMatchObject({ parcelaMensal: 405, creditoNoAno: 108_000, creditoNoFim: 574_664.74 });
    expect(projecaoAno(10)).toMatchObject({ parcelaMensal: 749.63, creditoNoAno: 199_900.46, creditoNoFim: 409_216.1 });
    expect(projecaoAno(16)).toMatchObject({ parcelaMensal: 1189.56, creditoNoAno: 317_216.91, creditoNoFim: 317_216.91 });
  });

  it("tem 16 linhas e vai de R$ 599 mil a R$ 317 mil no fim", () => {
    const t = tabelaProjecao();
    expect(t).toHaveLength(16);
    expect(Math.floor(t[0]!.creditoNoFim / 1000)).toBe(599);
    expect(Math.floor(t[15]!.creditoNoFim / 1000)).toBe(317);
  });
});
