import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { listarPercentuaisParcelaReduzida } from "./simulacao-linha";

describe("Fase 156 — cadastro completo de grupos", () => {
  it("preserva grupos legados e prioriza a coleção de opções fixas", () => {
    expect(listarPercentuaisParcelaReduzida({ percentuais_parcela_reduzida: null, percentual_parcela_reduzida: 60 })).toEqual([60]);
    expect(listarPercentuaisParcelaReduzida({ percentuais_parcela_reduzida: [60, 70], percentual_parcela_reduzida: 60 })).toEqual([60, 70]);
  });

  it("mantém a alteração global exclusiva da Platform", () => {
    const migration = readFileSync(resolve(process.cwd(), "../supabase/migrations/154_grupos_opcoes_reduzidas_e_cadastro_completo.sql"), "utf8");
    expect(migration).toContain("public.is_platform_superadmin()");
    expect(migration).toContain("v_origem IS DISTINCT FROM 'LOCAL'");
    expect(migration).toContain("REVOKE ALL ON FUNCTION");
  });
});
