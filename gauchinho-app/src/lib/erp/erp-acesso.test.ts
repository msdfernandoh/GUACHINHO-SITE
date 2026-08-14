import { describe, expect, it } from "vitest";
import { canAccessErpRoute, resolveErpUserAccess } from "./erp-acesso";

const config = {
  habilitado: true,
  modulos: ["painel", "leads", "financeiro", "usuarios"] as const,
};

describe("acesso individual ao ERP", () => {
  it("null preserva todos os menus habilitados para a empresa", () => {
    expect(resolveErpUserAccess(config, null)).toContain("contas-pagar");
    expect(resolveErpUserAccess(config, null)).toContain("usuarios");
  });

  it("array vazio bloqueia todos os menus e URLs", () => {
    expect(resolveErpUserAccess(config, [])).toEqual([]);
    expect(canAccessErpRoute(config, [], "contas-pagar")).toBe(false);
  });

  it("permite somente os menus selecionados e válidos no tenant", () => {
    expect(resolveErpUserAccess(config, ["painel", "contas-pagar", "grupos", "invalido"])).toEqual([
      "painel",
      "contas-pagar",
    ]);
  });
});
