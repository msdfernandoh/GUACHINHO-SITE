import { describe, expect, it } from "vitest";
import { parseHerancaLeadBody, telefoneBrValido } from "./lead";

describe("telefoneBrValido", () => {
  it("aceita celular e fixo com DDD", () => {
    expect(telefoneBrValido("(66) 99608-6030")).toBe("66996086030");
    expect(telefoneBrValido("+55 66 3531-0000")).toBe("6635310000");
  });
  it("recusa número incompleto ou sem DDD válido", () => {
    expect(telefoneBrValido("99608-6030")).toBeNull();
    expect(telefoneBrValido("(06) 99608-6030")).toBeNull();
  });
});

describe("parseHerancaLeadBody", () => {
  it("monta o lead com filhos e a carta de R$ 100 mil", () => {
    const r = parseHerancaLeadBody({ nome: "Maria", whatsapp: "(66) 99608-6030", filhosIdades: [3, 8] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.origem).toBe("landing_heranca");
    expect(r.payload.valor_credito).toBe(100_000);
    expect(r.payload.observacoes).toContain("2 filhos — 3 anos e 8 anos");
  });
  it("exige nome, telefone e idades", () => {
    expect(parseHerancaLeadBody({ whatsapp: "(66) 99608-6030", filhosIdades: [3] }).ok).toBe(false);
    expect(parseHerancaLeadBody({ nome: "Maria", whatsapp: "123", filhosIdades: [3] }).ok).toBe(false);
    expect(parseHerancaLeadBody({ nome: "Maria", whatsapp: "(66) 99608-6030", filhosIdades: [] }).ok).toBe(false);
  });
});
