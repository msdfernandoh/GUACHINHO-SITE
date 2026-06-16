import { describe, expect, it, vi } from "vitest";
import { resolveWhatsappImovelInteresse } from "./resolve-imovel";

vi.mock("@/server/config", () => ({
  DEFAULT_CONTATO: { whatsappPrincipal: "51999999999" },
  getConfigJsonPublic: vi.fn(async (key: string) => {
    if (key === "contato") return { whatsappPrincipal: "51999999999" };
    return {};
  }),
}));

vi.mock("@/lib/whatsapp/resolve-origem", () => ({
  resolveWhatsappOrigem: vi.fn(async () => null),
}));

describe("resolveWhatsappImovelInteresse", () => {
  it("prioriza WhatsApp do imóvel", async () => {
    const r = await resolveWhatsappImovelInteresse(
      {
        imovelWhatsapp: "51 98888-7777",
        imobiliariaWhatsapp: "51911111111",
        usarWhatsappImobiliaria: true,
      },
      "João",
      "Casa Centro",
    );
    expect(r?.origemResolvida).toBe("imovel");
    expect(r?.numero).toBe("51988887777");
  });

  it("usa imobiliária se imóvel não tem", async () => {
    const r = await resolveWhatsappImovelInteresse(
      {
        imovelWhatsapp: null,
        imobiliariaWhatsapp: "51911111111",
        usarWhatsappImobiliaria: true,
      },
      "Maria",
      "Apto",
    );
    expect(r?.origemResolvida).toBe("imobiliaria");
  });
});
