import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOME_MODULOS,
  homeModuloFlexOrder,
  isHomeModuloAtivo,
  modulosHomeAtivosOrdenados,
  normalizeHomeModulosConfig,
} from "@/lib/config/home-modulos";

describe("home-modulos", () => {
  it("uses defaults when config is empty", () => {
    const cfg = normalizeHomeModulosConfig(null);
    expect(cfg.modulos.length).toBe(DEFAULT_HOME_MODULOS.modulos.length);
    expect(isHomeModuloAtivo(cfg, "parceiros")).toBe(true);
  });

  it("respects ativo and ordem", () => {
    const cfg = normalizeHomeModulosConfig({
      modulos: [{ id: "parceiros", ativo: false, ordem: 99 }],
    });
    expect(isHomeModuloAtivo(cfg, "parceiros")).toBe(false);
    expect(homeModuloFlexOrder(cfg, "parceiros")).toBe(9999);
  });

  it("orders active modules", () => {
    const cfg = normalizeHomeModulosConfig({
      modulos: [
        { id: "cta_final", ativo: true, ordem: 1 },
        { id: "hero", ativo: true, ordem: 2 },
      ],
    });
    const ordered = modulosHomeAtivosOrdenados(cfg);
    expect(ordered[0]?.id).toBe("cta_final");
    expect(ordered[1]?.id).toBe("hero");
  });
});
