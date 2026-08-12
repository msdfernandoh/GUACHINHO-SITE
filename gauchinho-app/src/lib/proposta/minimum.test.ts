import { describe, expect, it } from "vitest";
import { assertPropostaMinimum, propostaMinimumValid } from "./minimum";

describe("mínimo canônico da proposta", () => {
  it("não cria sem dados ou somente com nome", () => {
    expect(propostaMinimumValid({})).toBe(false);
    expect(propostaMinimumValid({ nome: "Cliente" })).toBe(false);
  });
  it("aceita nome e telefone validado", () => {
    expect(propostaMinimumValid({ nome: "Cliente", telefone: "(65) 99999-9999" })).toBe(true);
  });
  it("produz mensagem explícita", () => {
    expect(() => assertPropostaMinimum({ nome: "Cliente", telefone: "123" })).toThrow("nome e telefone");
  });
});
