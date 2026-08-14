import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "../supabase/migrations/077_erp_importacao_socios_permissoes.sql"),
  "utf8",
);

describe("migration 077 e vínculos PLATFORM", () => {
  it("permite metadados sem enfraquecer a proteção do papel", () => {
    expect(migration).toContain("OLD.papel_id is distinct from NEW.papel_id");
    expect(migration).toContain("OLD.empresa_id is distinct from NEW.empresa_id");
    expect(migration).toContain("OLD.ativo is distinct from NEW.ativo");
    expect(migration).toContain("and not public.is_platform_superadmin()");
    expect(migration).toContain("Apenas SuperAdmins da Plataforma podem alterar");
  });
});
