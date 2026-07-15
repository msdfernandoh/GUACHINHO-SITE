import { describe, expect, it } from "vitest";
import {
  extrairPrimeiroPremioFederal,
  buscarPrimeiroPremioFederalPorData,
  normalizarDataSorteioIso,
} from "./buscar-resultado-federal";

describe("extrairPrimeiroPremioFederal", () => {
  it("080246 retorna 80246 (últimos 5 dígitos)", () => {
    expect(extrairPrimeiroPremioFederal(["080246", "040204"])).toBe("80246");
  });

  it("095866 retorna 95866", () => {
    expect(extrairPrimeiroPremioFederal(["095866"])).toBe("95866");
  });
});

describe("normalizarDataSorteioIso", () => {
  it("aceita ISO", () => {
    expect(normalizarDataSorteioIso("2026-07-04")).toBe("2026-07-04");
  });

  it("aceita BR", () => {
    expect(normalizarDataSorteioIso("04/07/2026")).toBe("2026-07-04");
  });
});

describe("buscarPrimeiroPremioFederalPorData (integração Caixa)", () => {
  it(
    "encontra concurso 6080 em 04/07/2026",
    async () => {
      const r = await buscarPrimeiroPremioFederalPorData("2026-07-04");
      expect(r.encontrado).toBe(true);
      expect(r.primeiroPremio).toBe("80246");
      expect(r.concurso).toBe("6080");
    },
    60_000,
  );
});
