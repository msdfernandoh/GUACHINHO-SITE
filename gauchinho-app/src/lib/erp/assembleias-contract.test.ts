import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("../supabase/migrations/069_erp_assembleias_pedras.sql");
const routes = read("src/lib/erp/erp-operational.ts");
const page = read("src/components/erp/erp-assembleias-page.tsx");

describe("contrato Assembleias/Pedras ERP", () => {
  it("é tenant-aware e valida grupo/cota no banco", () => {
    expect(migration).toContain("can_read_tenant_internal(empresa_id)");
    expect(migration).toContain("can_write_tenant_internal(empresa_id)");
    expect(migration).toContain("grupo_concedido_para_empresa");
    expect(migration).toContain("c.empresa_id = NEW.empresa_id");
    expect(migration).toContain("c.grupo_id = v_grupo_id");
  });

  it("preserva histórico e não altera contemplação", () => {
    expect(migration).not.toContain("FOR UPDATE TO authenticated");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("erp_assembleias_append_only");
    expect(migration).not.toMatch(/UPDATE public\.cotas_definitivas/i);
    expect(page).toContain("A atenção não altera contemplação nem resultado oficial");
  });

  it("usa cotas definitivas e mantém sorteios do Portal fora do ERP", () => {
    expect(page).toContain('.from("cotas_definitivas")');
    expect(routes).toContain('id: "assembleias"');
    expect(routes).not.toContain('id: "sorteios"');
  });
});
