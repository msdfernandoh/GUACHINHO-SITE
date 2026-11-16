import { describe, expect, it } from "vitest";
import { caminhoConvite, caminhoPainel, extrairCodigo, extrairToken, slugNome } from "./links";

describe("links com o nome da imobiliária", () => {
  const token = "IODgYrqZdIoeCHi8iRy-bmfEn9H7uTyR";
  it("gera o slug do nome", () => {
    expect(slugNome("IMOBILIÁRIA Teste & Cia")).toBe("imobiliaria-teste-cia");
  });
  it("recupera o token mesmo com '-' dentro dele", () => {
    expect(extrairToken(caminhoPainel("Imobiliária Teste", token).split("/").pop()!)).toBe(token);
    expect(extrairToken(token)).toBe(token);
  });
  it("recupera o código do convite", () => {
    expect(extrairCodigo(caminhoConvite("Imobiliária Teste", "MN964EWW").split("/").pop()!)).toBe("MN964EWW");
    expect(extrairCodigo("MN964EWW")).toBe("MN964EWW");
  });
});
