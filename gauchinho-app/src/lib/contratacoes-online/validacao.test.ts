import { describe, expect, it } from "vitest";
import {
  sanitizeCnpj,
  sanitizeCpf,
  sanitizeTelefone,
  validarCnpj,
  validarCpf,
} from "./validacao";

describe("validacao contratacao", () => {
  it("sanitiza documentos e telefone", () => {
    expect(sanitizeCpf("123.456.789-09")).toBe("12345678909");
    expect(sanitizeCnpj("12.345.678/0001-95")).toBe("12345678000195");
    expect(sanitizeTelefone("(51) 99999-8888")).toBe("51999998888");
  });

  it("valida CPF conhecido", () => {
    expect(validarCpf("529.982.247-25")).toBe(true);
    expect(validarCpf("111.111.111-11")).toBe(false);
  });

  it("valida CNPJ conhecido", () => {
    expect(validarCnpj("04.252.011/0001-10")).toBe(true);
    expect(validarCnpj("00.000.000/0000-00")).toBe(false);
  });
});
