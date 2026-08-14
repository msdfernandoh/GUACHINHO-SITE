import { describe, expect, it } from "vitest";
import { isMissingErpUserLinkColumns } from "./migration-077-compat";

describe("compatibilidade antes da migration 077", () => {
  it("reconhece as colunas novas ausentes", () => {
    expect(
      isMissingErpUserLinkColumns({
        code: "42703",
        message: "column empresa_usuarios.socio_pagador does not exist",
      }),
    ).toBe(true);
    expect(
      isMissingErpUserLinkColumns({
        message: "Could not find the 'erp_modulos_visiveis' column in the schema cache",
      }),
    ).toBe(true);
  });

  it("não oculta falhas de outras colunas ou permissões", () => {
    expect(isMissingErpUserLinkColumns({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isMissingErpUserLinkColumns({ code: "42703", message: "column papel_id does not exist" })).toBe(false);
  });
});
