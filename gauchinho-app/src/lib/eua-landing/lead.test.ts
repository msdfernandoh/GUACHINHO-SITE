import { describe, expect, it } from "vitest";
import { normalizarWhatsappInternacional, parseEuaLeadBody } from "./lead";

describe("normalizarWhatsappInternacional", () => {
  it("mantém o DDI dos EUA e do Brasil", () => {
    expect(normalizarWhatsappInternacional("+1 (407) 555-1234")).toBe("+1 4075551234");
    expect(normalizarWhatsappInternacional("+55 66 99608-6030")).toBe("+55 66996086030");
  });

  it("recusa número sem DDI", () => {
    expect(normalizarWhatsappInternacional("(407) 555-1234")).toBeNull();
    expect(normalizarWhatsappInternacional("+1 555")).toBeNull();
  });
});

describe("parseEuaLeadBody", () => {
  const base = { nome: " Ana  Souza ", whatsapp: "+1 407 555 1234" };

  it("monta o lead do plano com crédito e capacidade em dólar", () => {
    const r = parseEuaLeadBody({
      ...base,
      acao: "plano",
      plano: { objetivo: "renda", tipoBem: "imovel", urgencia: "ano", usdMensal: 300, cambio: 5.4, creditoTotal: 430000, parcelaReduzida: 1612.5, grupo: "1563" },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.nome).toBe("Ana Souza");
    expect(r.payload.whatsapp).toBe("+1 4075551234");
    expect(r.payload.origem).toBe("landing_eua");
    expect(r.payload.origem_detalhe).toBe("eua_plano");
    expect(r.payload.valor_credito).toBe(430000);
    expect(r.payload.capacidade_mensal).toContain("US$ 300/mês");
  });

  it("exige horário válido na reunião e registra no fuso de Sinop", () => {
    expect(parseEuaLeadBody({ ...base, acao: "reuniao", reuniao: {} }).ok).toBe(false);
    const r = parseEuaLeadBody({
      ...base,
      acao: "reuniao",
      reuniao: { inicioIso: "2026-11-13T13:00:00.000Z", fuso: "America/New_York", canal: "Zoom" },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.preferencia_atendimento).toBe("Reunião online — Zoom");
    expect(r.payload.quando_atendimento).toContain("09:00");
    expect(r.payload.quando_atendimento).toContain("America/New_York");
  });

  it("recusa ação, nome ou e-mail inválidos", () => {
    expect(parseEuaLeadBody({ ...base, acao: "x" }).ok).toBe(false);
    expect(parseEuaLeadBody({ ...base, nome: " ", acao: "plano" }).ok).toBe(false);
    expect(parseEuaLeadBody({ ...base, acao: "plano", email: "sem-arroba" }).ok).toBe(false);
  });
});
