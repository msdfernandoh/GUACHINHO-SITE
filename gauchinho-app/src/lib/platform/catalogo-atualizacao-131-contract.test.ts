import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const actions = readFileSync(
  resolve(process.cwd(), "src/app/platform/grupos/vinculacoes/actions.ts"),
  "utf8",
);
const erpButton = readFileSync(
  resolve(process.cwd(), "src/components/erp/erp-grupos-sync-button.tsx"),
  "utf8",
);
const platformView = readFileSync(
  resolve(process.cwd(), "src/components/platform/vinculacoes-legadas-view.tsx"),
  "utf8",
);

describe("fase 131 - atualização honesta e autorizada do catálogo", () => {
  it("autoriza superadmin da plataforma ou vínculo tenant com gerenciar_grupos", () => {
    expect(actions).toContain("isPlatformSuperadmin");
    expect(actions).toContain('requireTenantPermission("gerenciar_grupos")');
  });

  it("restringe a vinculação legada a superadmin da plataforma", () => {
    expect(actions).toContain("Apenas administradores da plataforma podem vincular grupos legados");
  });

  it("declara explicitamente que a ação não consulta administradora externa", () => {
    expect(actions).toContain("Nenhuma administradora externa foi consultada");
    expect(erpButton).toContain("Não consulta API externa");
    expect(platformView).toContain("integrações externas serão identificadas separadamente");
  });

  it("usa atualização de visualização como nome canônico", () => {
    expect(actions).toContain("atualizarVisualizacaoCatalogoAction");
    expect(erpButton).toContain("Atualizar visualização");
    expect(platformView).toContain("Atualizar visualização");
  });
});
