import { describe, expect, it } from "vitest";
import { normalizarIdadesFilhos, resumoFilhos } from "./filhos";

describe("filhos na inscrição", () => {
  it("normaliza idades válidas", () => {
    expect(normalizarIdadesFilhos([4, "7"])).toEqual([4, 7]);
    expect(normalizarIdadesFilhos(undefined)).toBeNull();
    expect(normalizarIdadesFilhos([])).toBeNull();
  });

  it("recusa idades inválidas", () => {
    expect(() => normalizarIdadesFilhos([-1])).toThrow();
    expect(() => normalizarIdadesFilhos([3.5])).toThrow();
    expect(() => normalizarIdadesFilhos("4")).toThrow();
    expect(() => normalizarIdadesFilhos(Array(11).fill(2))).toThrow();
  });

  it("resume em texto legível", () => {
    expect(resumoFilhos([5])).toBe("1 filho — 5 anos");
    expect(resumoFilhos([0, 1, 12])).toBe("3 filhos — menos de 1 ano, 1 ano e 12 anos");
  });
});
