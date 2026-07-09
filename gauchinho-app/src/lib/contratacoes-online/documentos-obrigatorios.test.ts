import { describe, expect, it } from "vitest";
import { documentosObrigatoriosPendentes, tiposDocumentoObrigatorios } from "./documentos-obrigatorios";

describe("documentos obrigatórios", () => {
  it("CPF exige CNH ou RG", () => {
    expect(tiposDocumentoObrigatorios("cpf")).toEqual(["documento_foto"]);
  });

  it("CNPJ exige cartão CNPJ e documento do responsável", () => {
    expect(tiposDocumentoObrigatorios("cnpj")).toEqual([
      "cartao_cnpj",
      "documento_responsavel",
    ]);
  });

  it("detecta pendentes", () => {
    expect(documentosObrigatoriosPendentes("cpf", [])).toEqual(["documento_foto"]);
    expect(documentosObrigatoriosPendentes("cpf", ["documento_foto"])).toEqual([]);
    expect(documentosObrigatoriosPendentes("cnpj", ["cartao_cnpj"])).toEqual([
      "documento_responsavel",
    ]);
  });
});
