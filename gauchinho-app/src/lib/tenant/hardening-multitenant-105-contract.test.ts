import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relative: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relative), "utf8");

describe("migration 105 — isolamento multi-tenant", () => {
  const migration = read("../supabase/migrations/105_hardening_multitenant_escala_franquias.sql");
  const imobiliarias = read("src/app/admin/imobiliarias/actions.ts");
  const imoveis = read("src/app/admin/imoveis/actions.ts");
  const operationalAccess = read("src/lib/tenant/operational-access.ts");

  it("autoriza site operacional por entitlement, não por slug ou UUID", () => {
    expect(operationalAccess).toContain("operationalEnabled === true");
    expect(operationalAccess).not.toContain("GAUCHINHO_SLUG");
    expect(migration).toContain("{site_publico,operacional_habilitado}");
  });

  it("mantém a imobiliária no vínculo empresa × usuário", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS imobiliaria_id uuid REFERENCES public.imobiliarias");
    expect(migration).toContain("current_usuario_imobiliaria_id(p_empresa_id uuid)");
    expect(migration).toContain("eu.empresa_id = p_empresa_id");
  });

  it("impede imóvel associado a imobiliária de outra empresa", () => {
    expect(migration).toContain("imoveis_empresa_imobiliaria_fk");
    expect(migration).toContain("FOREIGN KEY (empresa_id, imobiliaria_id)");
    expect(imoveis).toContain('.eq("empresa_id", empresaAtiva.id)');
    expect(imoveis).toContain('.eq("empresa_id", tenant.empresaId)');
  });

  it("filtra leituras e gravações de imobiliárias pela empresa ativa", () => {
    expect(imobiliarias).toContain('requireTenantPermission("gerenciar_imoveis")');
    expect(imobiliarias).toContain('.eq("empresa_id", empresaAtiva.id)');
    expect(imobiliarias).toContain('.eq("empresa_id", tenant.empresaId)');
  });
});
