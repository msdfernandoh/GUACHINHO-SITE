import { describe, expect, it } from "vitest";
import { parseCartaWhatsAppText } from "./parser";

const EXEMPLO = `CARTA CONTEMPLADA IMOVEL RACON 🏠🏠🏠
Crédito: R$ 1.012.000,00
Entrada: R$ 389.000,00
Prazo médio: 90 x 14.025
Saldo devedor 1.262.200,00
Próxima parcela 11/07/2026
TAXA DE TRANSFERÊNCIA R$ 5.880`;

describe("parseCartaWhatsAppText", () => {
  it("extrai campos do exemplo WhatsApp sem inventar valores", () => {
    const p = parseCartaWhatsAppText(EXEMPLO);
    expect(p.texto_original).toBe(EXEMPLO);
    expect(p.tipo_carta).toBe("imovel");
    expect(p.administradora).toBe("RACON");
    expect(p.credito).toBe(1_012_000);
    expect(p.entrada).toBe(389_000);
    expect(p.prazo_quantidade).toBe(90);
    expect(p.valor_parcela).toBe(14_025);
    expect(p.saldo_devedor).toBe(1_262_200);
    expect(p.proxima_parcela_data).toBe("2026-07-11");
    expect(p.taxa_transferencia).toBe(5_880);
  });

  it("deixa campos em branco quando ausentes", () => {
    const p = parseCartaWhatsAppText("CARTA CONTEMPLADA AUTOMOVEL SANTANDER\nCrédito: R$ 50.000,00");
    expect(p.tipo_carta).toBe("automovel");
    expect(p.credito).toBe(50_000);
    expect(p.entrada).toBeNull();
    expect(p.prazo_quantidade).toBeNull();
  });
});
