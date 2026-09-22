import { describe, expect, it } from "vitest";
import { senhaInicialIndicador } from "./acesso-indicador";

describe("senha inicial do app do indicador", () => {
  it("usa exclusivamente os últimos seis dígitos do CPF", () => {
    expect(senhaInicialIndicador("123.456.789-09")).toBe("678909");
  });

  it("recusa CPF incompleto", () => {
    expect(() => senhaInicialIndicador("12345")).toThrow("CPF inválido");
  });
});
