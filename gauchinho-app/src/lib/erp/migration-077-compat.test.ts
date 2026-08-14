import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isMissingErpUserLinkColumns } from "./migration-077-compat";

const migration077 = readFileSync(
  resolve(process.cwd(), "../supabase/migrations/077_erp_importacao_socios_permissoes.sql"),
  "utf8",
);

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

  it("limita a suspensão do trigger PLATFORM ao backfill de sócios", () => {
    const disableAt = migration077.indexOf(
      "disable trigger trg_validar_papel_empresa_usuario",
    );
    const backfillAt = migration077.indexOf("update public.empresa_usuarios eu");
    const enableAt = migration077.indexOf(
      "enable trigger trg_validar_papel_empresa_usuario",
    );

    expect(disableAt).toBeGreaterThan(-1);
    expect(backfillAt).toBeGreaterThan(disableAt);
    expect(enableAt).toBeGreaterThan(backfillAt);
  });
});
