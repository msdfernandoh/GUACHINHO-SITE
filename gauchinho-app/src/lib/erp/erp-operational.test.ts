import { describe, expect, it } from "vitest";
import { erpOperationalRouteEnabled, listEnabledOperationalRoutes } from "./erp-operational";

describe("ERP operational navigation", () => {
  it("deriva clientes e consultores sem ampliar as permissoes da empresa", () => {
    const config = { habilitado: true, modulos: ["leads", "usuarios"] as const };
    expect(erpOperationalRouteEnabled(config, "clientes")).toBe(true);
    expect(erpOperationalRouteEnabled(config, "consultores")).toBe(true);
    expect(erpOperationalRouteEnabled(config, "lances")).toBe(false);
  });

  it("sorteios e lances dependem do modulo grupos", () => {
    const config = { habilitado: true, modulos: ["grupos"] as const };
    expect(listEnabledOperationalRoutes(config).map((item) => item.id)).toEqual(["lances", "sorteios"]);
  });
});
