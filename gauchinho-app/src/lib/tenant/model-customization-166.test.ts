import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import { isRaconModel, resolveModelFamily } from "./model-family";
import { contactNumber, resolveSiteContacts } from "./site-contacts";
import { RaconInspiredHome } from "@/components/public/templates/racon-inspired-home";
import { RaconInspiredHeader, RaconInspiredFooter } from "@/components/public/templates/racon-inspired-chrome";

vi.stubGlobal("React", React);
describe("modelos independentes e contatos", () => {
  it("resolve cópia e cópia da cópia pelo vínculo de origem, sem herdar conteúdo", async () => {
    const read = vi.fn(async (id: string) => id === "copy" ? { codigo: "minha_marca", modelo_origem_id: "original" } : { codigo: "racon_inspired" });
    expect(await resolveModelFamily({ codigo: "outra_marca", modelo_origem_id: "copy" }, read)).toBe("racon_inspired");
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("não transforma Gauchinho, nome parecido ou modelo desconhecido em Racon", async () => {
    expect(await resolveModelFamily({ codigo: "gauchinho_default" }, vi.fn())).toBe("gauchinho_default");
    expect(isRaconModel({ codigo: "racon_copia_sem_origem" })).toBe(false);
    expect(isRaconModel({ codigo: "marca", layoutBase: "racon_inspired" })).toBe(true);
    expect(isRaconModel(null)).toBe(false);
  });
  it("encerra ciclos e origens inexistentes", async () => {
    const read = vi.fn(async () => ({ codigo: "copia", modelo_origem_id: "loop" }));
    expect(await resolveModelFamily({ codigo: "copia", modelo_origem_id: "loop" }, read)).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
    expect(await resolveModelFamily({ codigo: "copia", modelo_origem_id: "apagada" }, async () => null)).toBeNull();
  });
  it("prioriza contatos próprios sem inventar números", () => {
    expect(resolveSiteContacts({ telefone: "(66) 3333-2222" }, { telefone: "0800 123 4567", whatsapp: "66999998888" })).toEqual({ telefone: "(66) 3333-2222", whatsapp: "66999998888" });
    expect(resolveSiteContacts({})).toEqual({ telefone: "", whatsapp: "" });
    expect(contactNumber("+55 (66) 99999-8888", true)).toBe("5566999998888");
    expect(contactNumber("0800 123 4567")).toBe("08001234567");
    expect(contactNumber("0800 123 4567", true)).toBe("");
    expect(contactNumber("https://example.com")).toBe("");
    expect(contactNumber("6".repeat(33))).toBe("");
  });
  it("usa contatos configurados no topo e rodapé, com links válidos", () => {
    const props = { empresaNome: "Minha marca", menus: [], identidade: { marca_propria: true, contatos: { telefone: "0800 123 4567", whatsapp: "66999998888" } } };
    const header = renderToStaticMarkup(React.createElement(RaconInspiredHeader, props));
    const footer = renderToStaticMarkup(React.createElement(RaconInspiredFooter, props));
    expect(header).toContain('href="tel:08001234567"');
    expect(footer).toContain('href="https://wa.me/5566999998888"');
    expect(header).not.toContain("logoracon");
    expect(header).toContain("Minha marca");
  });
  it("marca própria não herda campanhas, estatísticas nem identidade Racon", () => {
    const html = renderToStaticMarkup(React.createElement(RaconInspiredHome, { empresaNome: "Parceiro Azul", identidade: { marca_propria: true }, isInteractive: false }));
    expect(html).toContain("Parceiro Azul");
    expect(html).not.toMatch(/(?:\/|%2F)racon(?:\/|%2F)/i);
    expect(html).not.toContain("Racon Consórcios");
    expect(html).not.toContain("Consórcio Racon");
    expect(html).not.toContain("+120 mil");
    expect(html).not.toContain("Televendas:");
    expect(html).not.toContain("Seja um");
  });
  it("preserva as campanhas do modelo Racon original", () => {
    const html = renderToStaticMarkup(React.createElement(RaconInspiredHome, { empresaNome: "Sorriso", identidade: {}, isInteractive: false }));
    expect(html).toMatch(/(?:\/|%2F)racon(?:\/|%2F)/i);
    expect(html).toContain("Racon Consórcios");
    expect(html).toContain("+120 mil");
  });
});
