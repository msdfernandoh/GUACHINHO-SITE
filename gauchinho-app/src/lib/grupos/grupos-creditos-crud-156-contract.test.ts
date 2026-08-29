import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("CRUD de créditos no cadastro de grupos", () => {
  it("oferece inclusão no formulário compartilhado", () => {
    const form = read("gauchinho-app/src/components/erp/group-catalog-form.tsx");
    expect(form).toContain("+ Adicionar crédito");
    expect(form).toContain('name="creditos_json"');
  });

  it("oferece edição e exclusão na tabela ERP", () => {
    const manager = read("gauchinho-app/src/components/erp/grupo-creditos-manager.tsx");
    expect(manager).toContain("Editar");
    expect(manager).toContain("Excluir");
    expect(manager).toContain("possuir histórico, será apenas inativado");
  });

  it("preserva histórico e restringe edição tenant a grupo local", () => {
    const migration = read("supabase/migrations/156_grupos_creditos_crud_erp_platform.sql");
    expect(migration).toContain("SUBSTITUIDO_PRESERVANDO_HISTORICO");
    expect(migration).toContain("v_grupo.origem_governanca is distinct from 'LOCAL'");
    expect(migration).toContain("public.can_write_tenant_internal(v_grupo.empresa_origem_id)");
  });
});
