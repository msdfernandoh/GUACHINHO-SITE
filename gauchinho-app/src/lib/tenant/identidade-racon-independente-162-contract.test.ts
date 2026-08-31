import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("identidade independente do tenant Racon", () => {
  const publicLayout = read("gauchinho-app/src/app/(public)/layout.tsx");
  const rootLayout = read("gauchinho-app/src/app/layout.tsx");
  const authLogin = read("gauchinho-app/src/app/(auth)/login/page.tsx");
  const adminLayout = read("gauchinho-app/src/app/admin/layout.tsx");
  const adminSidebar = read("gauchinho-app/src/components/admin/sidebar.tsx");
  const erpLayout = read("gauchinho-app/src/app/erp/layout.tsx");
  const simulator = read("gauchinho-app/src/components/simulador/simulador-page-shell.tsx");

  it("compõe SEO, nome, logo e cores com dados do tenant", () => {
    expect(rootLayout).toContain("tenant.branding.nome_site");
    expect(rootLayout).toContain("siteName: nome");
    expect(publicLayout).toContain("TenantBrandProvider");
    expect(publicLayout).toContain("tenant-racon-content");
  });

  it("não usa o rótulo Gauchinho no login do tenant", () => {
    expect(authLogin).toContain("`Acesso ${nome}`");
    expect(authLogin).not.toContain("Gauchinho Admin");
  });

  it("aplica tema claro e branding no admin e no ERP", () => {
    expect(adminLayout).toContain("tenant-admin-racon");
    expect(adminSidebar).toContain("brandLogoUrl");
    expect(adminSidebar).not.toContain(">Gauchinho<");
    expect(erpLayout).toContain("brandPrimary={brandPrimary}");
    expect(erpLayout).toContain("logoUrl={brandLogo}");
  });

  it("oculta o mascote e usa o nome do tenant no simulador", () => {
    expect(simulator).toContain("brand.isGauchinho ?");
    expect(simulator).toContain("Simulador {brand.nome}");
  });

  it("não carrega o assistente Gauchinho no tenant Racon", () => {
    expect(publicLayout).toContain("allowsOperational && isGauchinho");
  });
});
