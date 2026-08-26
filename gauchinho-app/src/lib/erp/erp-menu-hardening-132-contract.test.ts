import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("fase 132 - check-up e hardening dos menus do ERP", () => {
  it.each([
    ["leads", "leads"],
    ["propostas", "propostas"],
    ["contratacoes", "contratacoes"],
    ["grupos", "grupos"],
    ["lances", "lances"],
    ["repasse-franquia", "repasse-franquia"],
  ])("protege a rota direta %s com o acesso individual do módulo", (folder, routeId) => {
    expect(src(`src/app/erp/${folder}/layout.tsx`)).toContain(`requireErpRouteAccess("${routeId}")`);
  });

  it("protege ações operacionais mesmo quando invocadas fora da tela", () => {
    expect(src("src/app/erp/clientes/actions.ts")).toContain('requireErpRouteAccess("clientes")');
    expect(src("src/app/erp/lances/actions.ts")).toContain('requireErpRouteAccess("lances")');
    expect(src("src/app/erp/regras-comissao/actions.ts")).toContain('requireErpRouteAccess("regras-comissao")');
    expect(src("src/app/erp/repasse-franquia/actions.ts")).toContain('requireErpRouteAccess("repasse-franquia")');
  });

  it("valida contrato e tenant antes de assinar documento de cliente", () => {
    const actions = src("src/app/erp/clientes/actions.ts");
    expect(actions).toContain('from("contratacoes_online")');
    expect(actions).toContain('.eq("empresa_id", empresaAtiva.id)');
    expect(actions.indexOf('from("contratacoes_online")')).toBeLessThan(actions.indexOf("createSignedUrl(storagePath"));
  });

  it("limita catálogo de grupos às administradoras concedidas à empresa", () => {
    expect(src("src/app/erp/grupos/page.tsx")).toContain("listAdministradoraIdsAutorizadasForEmpresa");
    expect(src("src/app/erp/grupos/[id]/page.tsx")).toContain("getGrupoAutorizadoForEmpresa");
    expect(src("src/components/erp/erp-operational-pages.tsx")).toContain("administradoraIdsConsulta");
  });

  it("remove autoridade global e heurística textual das operações críticas de vendas", () => {
    const actions = src("src/app/erp/vendas/actions.ts");
    expect(actions).toContain('requireTenantPermission("formalizar_vendas")');
    expect(actions).toContain('papel?.codigo === "admin_empresa"');
    expect(actions).not.toContain("requireStaffAdmin");
    expect(actions).not.toContain("papelNome.includes");
  });

  it("grava propostas com empresa explícita e mantém retorno dentro do ERP", () => {
    const actions = src("src/app/admin/propostas/actions.ts");
    expect(actions).toContain('requireTenantPermission("gerenciar_propostas")');
    expect(actions).toContain("empresa_id: empresaAtiva.id");
    expect(actions).toContain('origemInterface === "erp" ? "/erp/propostas"');
  });

  it("não conserva fallback operacional para o UUID da primeira empresa", () => {
    for (const path of [
      "src/app/admin/comissoes/page.tsx",
      "src/app/admin/financeiro/page.tsx",
      "src/app/admin/vendas/page.tsx",
      "src/app/admin/contratacoes/actions.ts",
    ]) {
      expect(src(path)).not.toContain("7170f38e-15dd-4b19-8588-51e9a9cf0d4c");
    }
  });
});
