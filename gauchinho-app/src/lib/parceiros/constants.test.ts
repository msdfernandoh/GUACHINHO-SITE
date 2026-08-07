import { describe, expect, it } from "vitest";
import {
  FASE3_ADMIN_PARTICIPANTES_ENABLED,
  FASE3_PAPEL_PERMISSOES,
  FASE3_PARCEIRO_AREA_ENABLED,
  FASE3_PARCEIRO_PUBLIC_SITE_ENABLED,
  FASE3_PARCEIRO_SITES_ADMIN_ENABLED,
  FASE3_PERMISSOES,
  FASE3_VERCEL_DOMAINS_ENABLED,
  PAPEL_PARCEIRO_COMERCIAL,
  PAPEL_PARCEIRO_IMOBILIARIA_LEGADO,
  VERCEL_PARCEIRO_PROJECT_NAME,
} from "./constants";

describe("fase 3 constants", () => {
  it("feature flags desligadas por padrão", () => {
    expect(FASE3_ADMIN_PARTICIPANTES_ENABLED).toBe(false);
    expect(FASE3_PARCEIRO_SITES_ADMIN_ENABLED).toBe(false);
    expect(FASE3_PARCEIRO_PUBLIC_SITE_ENABLED).toBe(false);
    expect(FASE3_PARCEIRO_AREA_ENABLED).toBe(false);
    expect(FASE3_VERCEL_DOMAINS_ENABLED).toBe(false);
    expect(VERCEL_PARCEIRO_PROJECT_NAME).toBe("guachinho-site");
  });

  it("papel novo distinto do legado", () => {
    expect(PAPEL_PARCEIRO_COMERCIAL).toBe("parceiro_comercial");
    expect(PAPEL_PARCEIRO_IMOBILIARIA_LEGADO).toBe("parceiro_imobiliaria");
    expect(PAPEL_PARCEIRO_COMERCIAL).not.toBe(PAPEL_PARCEIRO_IMOBILIARIA_LEGADO);
  });

  it("matriz final papel → permissão", () => {
    const parceiro = FASE3_PAPEL_PERMISSOES.parceiro_comercial;
    expect(parceiro).toContain(FASE3_PERMISSOES.acessarAreaParceiro);
    expect(parceiro).not.toContain(FASE3_PERMISSOES.gerenciarSites);
    expect(parceiro).not.toContain(FASE3_PERMISSOES.gerenciarOrganizacoes);
    expect(parceiro).not.toContain(FASE3_PERMISSOES.gerenciarParticipantes);
    expect(parceiro).not.toContain(FASE3_PERMISSOES.visaoAmpliadaOrg);

    expect(FASE3_PAPEL_PERMISSOES.admin_empresa).toContain(FASE3_PERMISSOES.gerenciarSites);
    expect(FASE3_PAPEL_PERMISSOES.admin_empresa).toContain(FASE3_PERMISSOES.visaoAmpliadaOrg);
    expect(FASE3_PAPEL_PERMISSOES.parceiro_imobiliaria).toEqual([]);
  });
});
