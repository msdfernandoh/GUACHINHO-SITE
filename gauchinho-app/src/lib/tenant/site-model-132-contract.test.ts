import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(process.cwd(), "..");

function readRepoFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("Fase 132 — modelo de site canônico por empresa", () => {
  const migration = readRepoFile("supabase/migrations/132_site_modelo_empresa_canonico.sql");
  const detailPage = readRepoFile("gauchinho-app/src/app/platform/empresas/[id]/page.tsx");
  const listPage = readRepoFile("gauchinho-app/src/app/platform/empresas/page.tsx");
  const publicHome = readRepoFile("gauchinho-app/src/app/(public)/page.tsx");

  it("troca o modelo somente no vínculo canônico e exige modelo publicado", () => {
    expect(migration).toContain("INSERT INTO public.empresa_site_modelos");
    expect(migration).toContain("status = 'PUBLICADO'");
    expect(migration).not.toContain("UPDATE public.empresa_branding\n  SET\n    modelo_id");
    expect(migration).toContain("Acesso restrito ao Platform Superadmin.");
    expect(migration).toContain("ALTERAR_MODELO_SITE_EMPRESA");
  });

  it("restaura explicitamente o runtime e modelo próprios da Gauchinho", () => {
    expect(migration).toContain("'operacional_habilitado', true");
    expect(migration).toContain("e.slug = 'gauchinho'");
    expect(migration).toContain("sm.codigo = 'gauchinho_default'");
  });

  it("faz listagem e detalhe lerem empresa_site_modelos sem fallback enganoso", () => {
    expect(detailPage).toContain('.from("empresa_site_modelos")');
    expect(listPage).toContain('.from("empresa_site_modelos")');
    expect(listPage).toContain('|| "Não configurado"');
    expect(detailPage).not.toContain('modelo:site_modelos(*)');
  });

  it("só libera o runtime Gauchinho com entitlement e modelo correto", () => {
    expect(publicHome).toContain('tenant?.siteModel?.codigo === "gauchinho_default"');
    expect(publicHome).toContain("!tenant.allowsLegacyOperationalData || !usaModeloGauchinho");
  });
});
