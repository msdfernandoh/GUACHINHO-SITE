import { describe, expect, it } from "vitest";
import { haVagaDisponivel, quantidadeVagasInscricao, somarVagasUsadas } from "./vagas";

describe("vagas evento", () => {
  it("acompanhante consome 2 vagas", () => {
    expect(quantidadeVagasInscricao(false)).toBe(1);
    expect(quantidadeVagasInscricao(true)).toBe(2);
  });

  it("soma apenas confirmado e presente", () => {
    const total = somarVagasUsadas([
      { quantidade_vagas: 1, status: "confirmado" },
      { quantidade_vagas: 2, status: "presente" },
      { quantidade_vagas: 1, status: "lista_espera" },
      { quantidade_vagas: 2, status: "cancelado" },
    ]);
    expect(total).toBe(3);
  });

  it("limite esgotado", () => {
    expect(haVagaDisponivel(10, 9, 2)).toBe(false);
    expect(haVagaDisponivel(10, 8, 2)).toBe(true);
    expect(haVagaDisponivel(null, 100, 2)).toBe(true);
  });
});
