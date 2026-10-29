import { describe, expect, it } from "vitest";
import { normalizarWhatsappEquipeEvento, resolverWhatsappEquipeEvento, WHATSAPP_EQUIPE_EVENTO_PADRAO } from "./whatsapp-equipe";

describe("WhatsApp da equipe por evento", () => {
  it("normaliza celular e fixo BR com DDD e prefixo internacional opcional", () => {
    expect(normalizarWhatsappEquipeEvento("(66) 99999-1234")).toBe("66999991234");
    expect(normalizarWhatsappEquipeEvento("+55 (66) 99999-1234")).toBe("66999991234");
    expect(normalizarWhatsappEquipeEvento("(11) 3333-4444")).toBe("1133334444");
    expect(normalizarWhatsappEquipeEvento("(55) 99999-1234")).toBe("55999991234");
  });
  it("recusa telefone incompleto em vez de salvar um link inválido", () => {
    expect(() => normalizarWhatsappEquipeEvento("9999")).toThrow("DDD");
    expect(normalizarWhatsappEquipeEvento("")).toBeNull();
  });
  it("usa contato do evento e mantém padrão em eventos sem configuração", () => {
    expect(resolverWhatsappEquipeEvento("66999991234")).toBe("5566999991234");
    expect(resolverWhatsappEquipeEvento("11988887777")).toBe("5511988887777");
    expect(resolverWhatsappEquipeEvento(null)).toBe(WHATSAPP_EQUIPE_EVENTO_PADRAO);
    expect(resolverWhatsappEquipeEvento("inválido")).toBe(WHATSAPP_EQUIPE_EVENTO_PADRAO);
  });
});
