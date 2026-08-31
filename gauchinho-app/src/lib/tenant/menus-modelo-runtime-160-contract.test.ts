import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("menus e identidade efetivos do modelo no runtime", () => {
  const loader = read("gauchinho-app/src/lib/tenant/site-model.ts");
  const home = read("gauchinho-app/src/components/public/institutional-tenant-home.tsx");
  const layout = read("gauchinho-app/src/app/(public)/layout.tsx");
  const chrome = read("gauchinho-app/src/components/public/templates/racon-inspired-chrome.tsx");
  const migration = read("supabase/migrations/160_menus_site_entitlement_operacional.sql");

  it("carrega catálogo e filtra pelos IDs habilitados da empresa", () => {
    expect(loader).toContain("menus_habilitados");
    expect(loader).toContain("catalogo_menus");
    expect(loader).toContain("visibleModelMenus(");
  });

  it("entrega menus, seções e identidade completa ao template Racon", () => {
    expect(home).toContain("menus={siteModel.menus}");
    expect(home).toContain("secoes={siteModel.secoes}");
    expect(home).toContain("...siteModel.identidadeVisual");
    expect(home).toContain("showChrome={false}");
  });

  it("usa um único chrome Racon no layout e não injeta CTAs fora do catálogo", () => {
    expect(layout).toContain("<RaconInspiredHeader");
    expect(layout).toContain("<RaconInspiredFooter");
    expect(chrome).toContain("activeMenus.map");
    expect(chrome).not.toContain("Seja um Franqueado");
    expect(chrome).not.toContain("Simule seu Consórcio");
  });

  it("deriva o entitlement público dos menus aprovados e publicados", () => {
    expect(migration).toContain("NEW.status = 'PUBLICADO'");
    expect(migration).toContain("NEW.menus_habilitados");
    expect(migration).toContain("'operacional_habilitado', v_operacional");
  });
});
