import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "..");
const migration = readFileSync(
  resolve(root, "supabase/migrations/131_financeiro_contas_pagar_consulta_escalavel.sql"),
  "utf8",
);
const page = readFileSync(resolve(process.cwd(), "src/app/erp/contas-pagar/page.tsx"), "utf8");
const actions = readFileSync(resolve(process.cwd(), "src/app/erp/contas-pagar/actions.ts"), "utf8");
const ui = readFileSync(resolve(process.cwd(), "src/app/erp/contas-pagar/ui.tsx"), "utf8");

describe("Fase 133 / migration 131 — consulta escalável de contas a pagar", () => {
  it("remove carregamentos massivos do primeiro render", () => {
    expect(page).not.toContain(".limit(10000)");
    expect(page).not.toContain(".limit(500)");
    expect(page).not.toContain('from("caixa_movimentos")');
    expect(page).toContain("consultarContasPagar()");
  });

  it("pagina despesas e logs no banco com limites defensivos", () => {
    expect(migration).toContain("OFFSET (v_pagina - 1) * v_por_pagina LIMIT v_por_pagina");
    expect(migration).toContain("OFFSET (v_log_pagina-1)*v_logs_por_pagina LIMIT v_logs_por_pagina");
    expect(migration).toContain("least(greatest(coalesce(p_por_pagina, 25), 10), 100)");
    expect(ui).not.toContain("<option value={0}>Todas");
  });

  it("calcula saldo, cards e equalização sobre o conjunto completo", () => {
    expect(migration).toContain("'saldo_caixa'");
    expect(migration).toContain("'cards'");
    expect(migration).toContain("'balanco'");
    expect(migration).toContain("pagas_periodo AS MATERIALIZED");
    expect(ui).toContain("consulta.saldo_caixa");
    expect(ui).toContain("consulta.balanco.socios");
  });

  it("mantém isolamento tenant e não concede a service role", () => {
    expect(migration).toContain("public.can_read_tenant_internal(p_empresa_id)");
    expect(migration).toContain("c.empresa_id = p_empresa_id");
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, service_role/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION[\s\S]*TO authenticated/);
    expect(actions).toContain('requireErpRouteAccess("contas-pagar")');
  });

  it("consulta com sessão do usuário e não com cliente administrativo", () => {
    const consulta = actions.slice(actions.indexOf("export async function consultarContasPagar"), actions.indexOf("function failure"));
    expect(consulta).toContain("const session = await createClient()");
    expect(consulta).toContain('session.rpc("rpc_consultar_contas_pagar"');
    expect(consulta).not.toContain("createAdminClient");
  });
});
