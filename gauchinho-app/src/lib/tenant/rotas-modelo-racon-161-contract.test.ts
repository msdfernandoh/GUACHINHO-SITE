import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("rotas públicas do catálogo Racon", () => {
  const chrome = read("gauchinho-app/src/components/public/templates/racon-inspired-chrome.tsx");
  const home = read("gauchinho-app/src/components/public/templates/racon-inspired-home.tsx");
  const workspace = read("gauchinho-app/src/components/platform/template-workspace.tsx");
  const migration = read("supabase/migrations/161_corrige_rotas_catalogo_racon.sql");

  it("mantém Início no menu desktop e oferece destinos para Sobre e Contato", () => {
    expect(chrome).toContain('menus.filter((menu) => menu.id !== "login")');
    expect(chrome).toContain('<footer id="contato"');
    expect(home).toContain('<section id="sobre"');
  });

  it("não cria novos links para os slugs inexistentes", () => {
    for (const source of [home, workspace, migration]) {
      expect(source).not.toMatch(/\/consorcio\/(imoveis|veiculos|pesados)["']/);
    }
  });

  it("reconcilia catálogo, CTAs e rodapé do modelo publicado", () => {
    expect(migration).toContain("/consorcio/imovel-parcela-reduzida");
    expect(migration).toContain("/consorcio/carro-sem-entrada");
    expect(migration).toContain("/consorcio/caminhao-para-autonomo");
    expect(migration).toContain("WITH ORDINALITY");
  });
});
