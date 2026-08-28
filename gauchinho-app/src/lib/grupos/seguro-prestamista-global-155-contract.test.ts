import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("seguro prestamista global dos grupos", () => {
  it("nao oferece checkbox no cadastro compartilhado e persiste a disponibilidade", () => {
    const form = read("gauchinho-app/src/components/erp/group-catalog-form.tsx");
    const action = read("gauchinho-app/src/app/erp/grupos/actions.ts");

    expect(form).not.toContain('name="seguro_habilitado"');
    expect(form).toContain("Taxa do seguro prestamista");
    expect(action).toContain("seguro_habilitado: true");
  });

  it("normaliza grupos existentes e defaults futuros", () => {
    const migration = read("supabase/migrations/155_seguro_prestamista_regra_global_grupos.sql");

    expect(migration).toContain("seguro_habilitado = true");
    expect(migration).toContain("seguro_pos_contemplacao = true");
    expect(migration).toContain("alter column seguro_habilitado set default true");
    expect(migration).toContain("alter column seguro_pos_contemplacao set default true");
  });
});
