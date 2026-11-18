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
  it("recupera o token hexadecimal de uma imobiliária pré-cadastrada", () => {
    const legado = "0123456789abcdef".repeat(4);
    expect(extrairToken(caminhoPainel("Tozi Imóveis", legado).split("/").pop()!)).toBe(legado);
    expect(extrairToken(legado)).toBe(legado);
  });
  it("rejeita um segmento com codificação inválida", () => {
    expect(extrairToken("%")).toBe("");
  });
  it("recupera o código do convite", () => {
    expect(extrairCodigo(caminhoConvite("Imobiliária Teste", "MN964EWW").split("/").pop()!)).toBe("MN964EWW");
    expect(extrairCodigo("MN964EWW")).toBe("MN964EWW");
  });
});
