import { describe, expect, it } from "vitest";
import { extrairLeadDaConversa } from "./extrair-lead";

describe("extrairLeadDaConversa", () => {
  it("extrai dados do exemplo comercial", () => {
    const msg =
      "Quero simular um imóvel de 500 mil em Sinop, tenho 50 mil de lance. Meu nome é João e meu WhatsApp é 65999999999.";
    const { dados, prontoParaLead } = extrairLeadDaConversa([{ role: "user", content: msg }]);
    expect(dados.nome?.toLowerCase()).toContain("joão");
    expect(dados.whatsapp).toBe("65999999999");
    expect(dados.cidade?.toLowerCase()).toContain("sinop");
    expect(dados.tipoInteresse?.toLowerCase()).toMatch(/imóvel|consórcio/);
    expect(dados.valorAproximado).toBeGreaterThanOrEqual(500_000);
    expect(dados.recursoProprio).toBeGreaterThanOrEqual(50_000);
    expect(prontoParaLead).toBe(true);
  });

  it("não marca pronto sem whatsapp", () => {
    const { prontoParaLead } = extrairLeadDaConversa([
      { role: "user", content: "Quero consórcio de carro. Meu nome é Ana." },
    ]);
    expect(prontoParaLead).toBe(false);
  });
});
