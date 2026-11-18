import { describe, expect, it } from "vitest";
import { aceiteImobiliariaAtual } from "./types";

describe("aceite de parceria SPL", () => {
  const cadastro = {
    modelo_parceria: "GERADOR_OPORTUNIDADES" as const,
    termos_modelo: "GERADOR_OPORTUNIDADES",
    termos_versao: "v1",
    termos_aceito_em: "2026-11-18T12:00:00Z",
  };

  it("confirma o aceite somente para a versão e o modelo exibidos", () => {
    expect(aceiteImobiliariaAtual(cadastro, "v1")).toBe(true);
    expect(aceiteImobiliariaAtual(cadastro, "v2")).toBe(false);
    expect(aceiteImobiliariaAtual({ ...cadastro, modelo_parceria: "GERADOR_NEGOCIOS" }, "v1")).toBe(false);
    expect(aceiteImobiliariaAtual({ ...cadastro, termos_aceito_em: null }, "v1")).toBe(false);
  });
});
