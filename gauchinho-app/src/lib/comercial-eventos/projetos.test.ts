import { describe, expect, it } from "vitest";
import { linkMapaEvento, localAtendimentoEvento, projetoDoEvento, quandoEvento } from "./projetos";

describe("projetos de evento", () => {
  it("identifica o projeto pelo slug", () => {
    expect(projetoDoEvento("heranca-inteligente")).toBe("Método Herança Inteligente");
    expect(projetoDoEvento("network-de-negocios")).toBeNull();
  });

  it("monta o local de atendimento", () => {
    expect(
      localAtendimentoEvento({ local: "Auditório da UniFECAF", endereco: "Av. Embaúbas, 2114 - Setor Comercial", cidade: "Sinop", estado: "MT" }),
    ).toBe("Presencial · Auditório da UniFECAF · Av. Embaúbas, 2114 - Setor Comercial · Sinop/MT");
    expect(localAtendimentoEvento({ local: null, endereco: null, cidade: null, estado: null })).toBeNull();
  });

  it("formata data e hora em Sinop", () => {
    expect(quandoEvento("2026-11-17T23:30:00Z")).toMatch(/terça-feira.*17\/11\/2026 às 19:30/);
    expect(quandoEvento(null)).toBeNull();
  });
});

describe("link do mapa", () => {
  it("usa endereço, CEP e cidade", () => {
    const url = linkMapaEvento({ local: "Auditório da UniFECAF", endereco: "Av. das Embaúbas, 2114 - Setor Comercial, CEP 78550-110", cidade: "Sinop", estado: "MT" });
    expect(url).toContain("https://www.google.com/maps/search/?api=1&query=");
    expect(decodeURIComponent(url!.split("query=")[1]!)).toBe("Av. das Embaúbas, 2114 - Setor Comercial, CEP 78550-110, Sinop - MT");
  });
  it("sem endereço usa o local; sem nada, null", () => {
    expect(decodeURIComponent(linkMapaEvento({ local: "UniFECAF", endereco: null, cidade: "Sinop", estado: null })!.split("query=")[1]!)).toBe("UniFECAF, Sinop");
    expect(linkMapaEvento({ local: null, endereco: null, cidade: "Sinop", estado: "MT" })).toBeNull();
  });
});
