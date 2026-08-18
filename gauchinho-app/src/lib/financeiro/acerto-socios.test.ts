import { describe, expect, it } from "vitest";
import { calcularAcertoSocios } from "./acerto-socios";

describe("acerto das despesas da empresa entre dois sócios", () => {
  it("divide a dívida da empresa em partes iguais", () => {
    expect(calcularAcertoSocios(23_454.46, 0)).toMatchObject({
      debitoEmpresa: 23_454.46,
      cotaIndividual: 11_727.23,
      diferencaPagamentos: 23_454.46,
      transferenciaParaEqualizar: 11_727.23,
      despesaAdicionalParaEqualizar: 23_454.46,
      socioCredor: "A",
    });
  });

  it("zera o acerto quando ambos pagaram o mesmo valor", () => {
    expect(calcularAcertoSocios(500, 500)).toMatchObject({
      debitoEmpresa: 1_000,
      cotaIndividual: 500,
      transferenciaParaEqualizar: 0,
      despesaAdicionalParaEqualizar: 0,
      socioCredor: null,
    });
  });
});
