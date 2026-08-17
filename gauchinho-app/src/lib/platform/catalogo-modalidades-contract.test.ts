import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "../supabase/migrations/080_catalogo_grupos_modalidades_produtos.sql"), "utf8");

describe("catálogo Grupo N:N modalidades", () => {
  it("modela disponibilidades e valores dinamicamente", () => {
    expect(migration).toContain("CREATE TABLE public.grupos_modalidades_disponiveis");
    expect(migration).toContain("CREATE TABLE public.grupo_cota_modalidade_valores");
    expect(migration).not.toMatch(/DROP (TABLE|COLUMN)/i);
  });
  it("não infere modalidade nova do Grupo", () => {
    expect(migration).toContain("nao pode ser inferida do Grupo");
    expect(migration).toContain("valor_parcela_modalidade");
    expect(migration).toContain("BACKFILL_MODALIDADE_SINGULAR_076");
    expect(migration).toContain("v_venda.snapshot_venda");
    expect(migration).toContain("pg_get_functiondef");
  });
  it("mantém escrita global exclusiva da Platform", () => {
    expect(migration.match(/public\.is_platform_superadmin\(\)/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
