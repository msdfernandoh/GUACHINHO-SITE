import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Fase 213 — identidade publica independente do site parceiro", () => {
  const layout = fs.readFileSync(
    path.join(process.cwd(), "src/app/(public)/layout.tsx"),
    "utf8"
  );

  it("nao classifica o parceiro como Gauchinho por compartilhar o ERP", () => {
    expect(layout).toContain("const isGauchinho = !isPartnerSite");
  });

  it("nao sobrepoe as cores do parceiro com o branding da empresa do ERP", () => {
    expect(layout).toContain("if (!isPartnerSite && tenant?.branding.cor_primaria)");
    expect(layout).toContain("corPrimaria: isPartnerSite");
    expect(layout).toContain("corSecundaria: isPartnerSite");
    expect(layout).toContain("corDestaque: isPartnerSite");
  });

  it("identifica o canal publico pelo slug do proprio parceiro", () => {
    expect(layout).toContain("slug: partnerView?.slug || tenant?.slug");
  });
});
