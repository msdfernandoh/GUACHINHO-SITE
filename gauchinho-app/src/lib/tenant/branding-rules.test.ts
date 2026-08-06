import { describe, expect, it } from "vitest";
import {
  canPublishTenantSite,
  resolveBrandingFallbackKind,
  assertNoCrossTenantBrandingMerge,
} from "./branding-rules";

describe("resolveBrandingFallbackKind", () => {
  it("Gauchinho sem branding usa legado", () => {
    expect(
      resolveBrandingFallbackKind({
        slug: "gauchinho",
        hasBrandingRow: false,
        isDevelopment: false,
      }),
    ).toBe("legacy_gauchinho");
  });

  it("Empresa B sem branding não usa fallback Gauchinho", () => {
    expect(
      resolveBrandingFallbackKind({
        slug: "empresa-b",
        hasBrandingRow: false,
        isDevelopment: false,
      }),
    ).toBe("none");
  });

  it("Empresa B em development pode usar branding fictício local", () => {
    expect(
      resolveBrandingFallbackKind({
        slug: "empresa-b",
        hasBrandingRow: false,
        isDevelopment: true,
      }),
    ).toBe("dev_empresa_b");
  });

  it("outro tenant sem branding retorna none (não configurado)", () => {
    expect(
      resolveBrandingFallbackKind({
        slug: "outra",
        hasBrandingRow: false,
        isDevelopment: false,
      }),
    ).toBe("none");
  });
});

describe("canPublishTenantSite", () => {
  it("RASCUNHO não publica em production", () => {
    expect(
      canPublishTenantSite({
        isDevelopment: false,
        empresaStatus: "ativo",
        empresaAtivo: true,
        brandingStatus: "RASCUNHO",
        dominioAtivo: true,
        dominioVerificado: true,
      }),
    ).toBe(false);
  });

  it("PUBLICADO só com empresa e domínio válidos", () => {
    expect(
      canPublishTenantSite({
        isDevelopment: false,
        empresaStatus: "ativo",
        empresaAtivo: true,
        brandingStatus: "PUBLICADO",
        dominioAtivo: true,
        dominioVerificado: true,
      }),
    ).toBe(true);
    expect(
      canPublishTenantSite({
        isDevelopment: false,
        empresaStatus: "em_treinamento",
        empresaAtivo: false,
        brandingStatus: "PUBLICADO",
        dominioAtivo: true,
        dominioVerificado: true,
      }),
    ).toBe(false);
    expect(
      canPublishTenantSite({
        isDevelopment: false,
        empresaStatus: "ativo",
        empresaAtivo: true,
        brandingStatus: "PUBLICADO",
        dominioAtivo: true,
        dominioVerificado: false,
      }),
    ).toBe(false);
  });
});

describe("assertNoCrossTenantBrandingMerge", () => {
  it("nunca herda entre tenants distintos", () => {
    expect(assertNoCrossTenantBrandingMerge("gauchinho", "empresa-b")).toBe(false);
    expect(assertNoCrossTenantBrandingMerge("gauchinho", "gauchinho")).toBe(true);
  });
});
