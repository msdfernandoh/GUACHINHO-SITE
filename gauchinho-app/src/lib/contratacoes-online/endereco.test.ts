import { describe, expect, it } from "vitest";
import {
  enderecoToDbUpdates,
  formatCepBrInput,
  hydrateContratacaoEndereco,
  isContratacaoEnderecoSchemaError,
  parseEnderecoContratacao,
  sanitizeCep,
} from "./endereco";
import type { ContratacaoOnlineRow } from "./types";

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

  it("detecta erro de coluna de endereço no schema cache", () => {
    expect(
      isContratacaoEnderecoSchemaError(
        "Could not find the 'bairro' column of 'contratacoes_online' in the schema cache",
      ),
    ).toBe(true);
  });

  it("hidrata endereço de dados_simulacao", () => {
    const row = hydrateContratacaoEndereco({
      cep: null,
      dados_simulacao: {
        endereco: {
          cep: "90000000",
          endereco: "Rua B",
          numero: "10",
          complemento: null,
          bairro: "Centro",
          cidade: "Porto Alegre",
          uf: "RS",
        },
      },
    } as ContratacaoOnlineRow);
    expect(row.cep).toBe("90000000");
    expect(row.bairro).toBe("Centro");
  });
});
