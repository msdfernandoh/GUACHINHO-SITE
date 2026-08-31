import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "..");
const migration = readFileSync(resolve(root, "supabase/migrations/162_agenda_comercial_tenant_ux_permissoes.sql"), "utf8");
const actions = readFileSync(resolve(process.cwd(), "src/app/admin/agenda/actions.ts"), "utf8");

describe("Fase 162 — contrato tenant da Agenda", () => {
  it("torna compromissos tenant-aware sem fallback fixo", () => {
    expect(migration).toContain("ALTER COLUMN empresa_id SET NOT NULL");
    expect(migration).toContain("agenda_compromissos_select_tenant");
    expect(migration).not.toContain("slug = 'gauchinho'");
  });

  it("valida lead e responsável no mesmo tenant", () => {
    expect(migration).toContain("Lead nao pertence a empresa da agenda");
    expect(migration).toContain("Responsavel nao possui vinculo ativo");
  });

  it("conclui compromisso e lead na mesma transação", () => {
    expect(migration).toContain("rpc_concluir_compromisso_agenda");
    expect(migration).toContain("FOR UPDATE");
    expect(actions).toContain('.rpc("rpc_concluir_compromisso_agenda"');
    expect(actions).not.toContain('from("agenda_compromissos")\n    .update({\n      status: "concluido"');
  });

  it("todas as ações resolvem a permissão pelo tenant", () => {
    expect(actions).toContain('requireTenantPermission("acessar_agenda")');
    expect(actions).not.toContain("requireUsuario()");
  });
});
