import { describe, expect, it } from "vitest";
import { ERP_MODULES, getErpSistemaConfig, normalizeErpSistemaConfig } from "./erp-modulos";

describe("erp-modulos", () => {
  it("mantém o ERP desligado sem configuração explícita", () => {
    expect(getErpSistemaConfig({})).toEqual({ habilitado: false, modulos: [] });
  });

  it("aceita apenas módulos do catálogo controlado", () => {
    const config = normalizeErpSistemaConfig({ habilitado: true, modulos: ["painel", "vendas", "administradoras", "desconhecido"] });
    expect(config).toEqual({ habilitado: true, modulos: ["painel", "vendas"] });
    expect(ERP_MODULES.some((module) => module.id === "administradoras")).toBe(false);
  });

  it("reconhece os módulos persistidos pelo onboarding SaaS", () => {
    expect(getErpSistemaConfig({
      erp_habilitado: true,
      modulos_erp_selecionados: ["painel", "financeiro"],
    })).toEqual({ habilitado: true, modulos: ["painel", "financeiro"] });
  });

  it("mantém a configuração explícita como prioritária", () => {
    expect(getErpSistemaConfig({
      erp_habilitado: true,
      modulos_erp_selecionados: ["financeiro"],
      erp_sistema: { habilitado: false, modulos: [] },
    })).toEqual({ habilitado: false, modulos: [] });
  });
});
