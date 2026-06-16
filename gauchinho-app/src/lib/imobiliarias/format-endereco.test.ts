import { describe, expect, it } from "vitest";
import { formatEnderecoImobiliaria } from "./format-endereco";

describe("formatEnderecoImobiliaria", () => {
  it("monta endereço completo", () => {
    expect(
      formatEnderecoImobiliaria({
        endereco: "Av. dos Ingás",
        numero: "1500",
        bairro: "Centro",
        cidade: "Sinop",
        estado: "MT",
      }),
    ).toBe("Av. dos Ingás, 1500 - Centro - Sinop/MT");
  });

  it("aceita campos parciais", () => {
    expect(formatEnderecoImobiliaria({ cidade: "Porto Alegre", estado: "RS" })).toBe("Porto Alegre/RS");
  });
});
