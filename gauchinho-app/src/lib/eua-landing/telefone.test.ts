import { describe, expect, it } from "vitest";
import { mascararTelefone, telefoneCompleto } from "./telefone";

describe("mascararTelefone", () => {
  it("formata número dos EUA enquanto digita", () => {
    expect(mascararTelefone("+1", "407")).toBe("(407");
    expect(mascararTelefone("+1", "40755")).toBe("(407) 55");
    expect(mascararTelefone("+1", "4075551234")).toBe("(407) 555-1234");
    expect(mascararTelefone("+1", "407555123499")).toBe("(407) 555-1234");
  });

  it("aceita o número colado com o 1 do país", () => {
    expect(mascararTelefone("+1", "1 407 555 1234")).toBe("(407) 555-1234");
  });

  it("usa a máscara brasileira no +55", () => {
    expect(mascararTelefone("+55", "66996086030")).toBe("(66) 99608-6030");
  });
});

describe("telefoneCompleto", () => {
  it("exige a quantidade de dígitos de cada país", () => {
    expect(telefoneCompleto("+1", "(407) 555-1234")).toBe(true);
    expect(telefoneCompleto("+1", "(407) 555-12")).toBe(false);
    expect(telefoneCompleto("+55", "(66) 99608-6030")).toBe(true);
    expect(telefoneCompleto("+55", "(66) 9960")).toBe(false);
  });
});
