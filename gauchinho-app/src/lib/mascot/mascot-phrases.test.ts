import { describe, expect, it } from "vitest";
import { MASCOT_PHRASES, resolveMascotContext } from "./mascot-phrases";

describe("resolveMascotContext", () => {
  it("home e rotas prioritárias", () => {
    expect(resolveMascotContext("/")).toBe("home");
    expect(resolveMascotContext("/simulador")).toBe("simulador");
    expect(resolveMascotContext("/simulador", "?tipo=imovel")).toBe("simulador_imovel");
    expect(resolveMascotContext("/simulador", "?tipo=automovel")).toBe("simulador_veiculo");
    expect(resolveMascotContext("/grupos")).toBe("grupos");
    expect(resolveMascotContext("/cartas-contempladas")).toBe("contempladas");
    expect(resolveMascotContext("/oportunidades-imobiliarias")).toBe("imoveis");
    expect(resolveMascotContext("/eventos/abc")).toBe("eventos");
    expect(resolveMascotContext("/calculadoras")).toBe("calculadoras");
    expect(resolveMascotContext("/seguradoras")).toBe("seguradoras");
    expect(resolveMascotContext("/login")).toBe("login");
  });

  it("cada contexto tem frases", () => {
    for (const key of Object.keys(MASCOT_PHRASES) as (keyof typeof MASCOT_PHRASES)[]) {
      expect(MASCOT_PHRASES[key].length).toBeGreaterThan(0);
    }
  });
});
