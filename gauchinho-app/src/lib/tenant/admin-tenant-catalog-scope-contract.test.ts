import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("escopo tenant das consultas SaaS no admin do site", () => {
  it("mostra somente a empresa ativa e bloqueia detalhe de outro tenant", () => {
    const list = read("gauchinho-app/src/app/admin/empresas/page.tsx");
    const detail = read("gauchinho-app/src/app/admin/empresas/[id]/page.tsx");
    expect(list).toContain("empresaAtiva");
    expect(list).not.toContain("fetchEmpresasList");
    expect(detail).toContain("id !== empresaAtiva.id");
    expect(detail).toContain("notFound()");
  });

  it("lista e abre somente administradoras autorizadas para a empresa ativa", () => {
    const list = read("gauchinho-app/src/app/admin/administradoras/page.tsx");
    const detail = read("gauchinho-app/src/app/admin/administradoras/[id]/page.tsx");
    expect(list).toContain("listAdministradorasAutorizadasForEmpresa(empresaAtiva.id)");
    expect(list).not.toContain("fetchAdministradorasGlobaisList");
    expect(detail).toContain("getAdministradoraAutorizadaById(empresaAtiva.id, id)");
    expect(detail).not.toContain("fetchEmpresasFranqueadasDaAdministradora");
  });
});
