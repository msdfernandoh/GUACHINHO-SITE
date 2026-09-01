import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "..");

describe("fase 212 — parceiro e domínio visíveis no SaaS", () => {
  it("consulta as colunas reais e carrega modelo/domínio do site parceiro", () => {
    const source = readFileSync(
      resolve(root, "gauchinho-app/src/app/platform/empresas/[id]/page.tsx"),
      "utf8",
    );
    expect(source).toContain("id, nome_fantasia, status");
    expect(source).toContain("modelo:site_modelos");
    expect(source).toContain("dominios:parceiro_site_dominios");
    expect(source).toContain("nome: p.nome_fantasia");
    expect(source).toContain("Não foi possível carregar os parceiros e sites");
  });

  it("preserva o acesso administrativo do responsável convertido", () => {
    const migration = readFileSync(
      resolve(root, "supabase/migrations/212_racon_sinop_acesso_administrativo_erp_gauchinho.sql"),
      "utf8",
    );
    expect(migration).toContain("codigo = 'admin_empresa'");
    expect(migration).toContain("erp_modulos_visiveis = NULL");
    expect(migration).toContain("CONVERSAO_MASTER_PARCEIRO_ADMIN_ASSISTIDA");
  });

  it("usa no parceiro o modelo completo publicado e preserva suas rotas", () => {
    const loader = readFileSync(
      resolve(root, "gauchinho-app/src/lib/parceiros/public-site-loader.ts"),
      "utf8",
    );
    const page = readFileSync(
      resolve(root, "gauchinho-app/src/app/(parceiro-site)/parceiro/[slug]/page.tsx"),
      "utf8",
    );
    const proxy = readFileSync(resolve(root, "gauchinho-app/src/proxy.ts"), "utf8");
    expect(loader).toContain("catalogo_menus, secoes_home, configuracao_footer, logo_padrao_url");
    expect(page).toContain("menus={result.view.modelo_menus}");
    expect(page).toContain("secoes={result.view.modelo_secoes}");
    expect(proxy).toContain("partnerOperationalPaths");
    expect(proxy).toContain('"/grupos"');
  });
});
