import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/app/erp/regras-comissao/actions.ts"), "utf8");

describe("contrato de segurança do cadastro de regras", () => {
  it("usa autorização tenant e não usa service role", () => {
    expect(source).toContain('rpc("can_write_tenant_internal"');
    expect(source).not.toContain("createAdminClient");
  });

  it("cria regra sem homologação ou percentual implícito", () => {
    expect(source).toContain("configuracao_homologada: false");
    expect(source).toContain('origem_configuracao: "ERP_MANUAL_NAO_HOMOLOGADO"');
    expect(source).not.toMatch(/4\.0{2,}|1\.5{2,}/);
  });

  it("reserva homologação ao Platform e bloqueia escopo ambíguo", () => {
    expect(source).toContain("isPlatformSuperadmin");
    expect(source).toContain("commissionRuleScopesConflict");
    expect(source).toContain("Homologação bloqueada");
  });
});
