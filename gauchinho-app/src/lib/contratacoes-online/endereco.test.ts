import { describe, expect, it } from "vitest";
import {
  enderecoToDbUpdates,
  formatCepBrInput,
  parseEnderecoContratacao,
  sanitizeCep,
} from "./endereco";

describe("endereco contratacao", () => {
  it("máscara e sanitização de CEP", () => {
    expect(formatCepBrInput("78550000")).toBe("78550-000");
    expect(formatCepBrInput("78550-000")).toBe("78550-000");
    expect(sanitizeCep("78.550-000")).toBe("78550000");
  });

  it("valida endereço obrigatório", () => {
    expect(() =>
      parseEnderecoContratacao({
        cep: "78550",
        endereco: "Rua A",
        numero: "1",
        bairro: "Centro",
        cidade: "Sinop",
        uf: "MT",
      }),
    ).toThrow(/CEP/i);

    expect(() =>
      parseEnderecoContratacao({
        cep: "78550000",
        endereco: "",
        numero: "1",
        bairro: "Centro",
        cidade: "Sinop",
        uf: "MT",
      }),
    ).toThrow(/Endereço/i);

    expect(() =>
      parseEnderecoContratacao({
        cep: "78550000",
        endereco: "Rua A",
        numero: "1",
        bairro: "Centro",
        cidade: "Sinop",
        uf: "M",
      }),
    ).toThrow(/UF/i);
  });

  it("normaliza campos para PATCH / banco", () => {
    const campos = parseEnderecoContratacao({
      cep: "78550-000",
      endereco: " Av. Principal ",
      numero: " 100 ",
      complemento: " Sala 2 ",
      bairro: " Centro ",
      cidade: " Sinop ",
      uf: "mt",
    });
    expect(campos).toEqual({
      cep: "78550000",
      endereco: "Av. Principal",
      numero: "100",
      complemento: "Sala 2",
      bairro: "Centro",
      cidade: "Sinop",
      uf: "MT",
    });
    expect(enderecoToDbUpdates(campos)).toEqual({
      cep: "78550000",
      endereco: "Av. Principal",
      numero: "100",
      complemento: "Sala 2",
      bairro: "Centro",
      cidade: "Sinop",
      uf: "MT",
    });
  });

  it("complemento opcional vira null no banco", () => {
    const campos = parseEnderecoContratacao({
      cep: "78550000",
      endereco: "Rua A",
      numero: "1",
      bairro: "Centro",
      cidade: "Sinop",
      uf: "MT",
    });
    expect(campos.complemento).toBeNull();
    expect(enderecoToDbUpdates(campos).complemento).toBeNull();
  });
});
