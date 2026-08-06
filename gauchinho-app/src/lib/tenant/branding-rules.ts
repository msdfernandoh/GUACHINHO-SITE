import { GAUCHINHO_SLUG, EMPRESA_B_SLUG } from "./constants";

export type BrandingFallbackKind = "legacy_gauchinho" | "dev_empresa_b" | "none";

/**
 * Decide qual fallback de branding aplicar quando não há linha em empresa_branding.
 * Nunca herda branding da Gauchinho para outro tenant.
 */
export function resolveBrandingFallbackKind(input: {
  slug: string;
  hasBrandingRow: boolean;
  isDevelopment: boolean;
}): BrandingFallbackKind {
  if (input.hasBrandingRow) return "none";
  if (input.slug === GAUCHINHO_SLUG) return "legacy_gauchinho";
  if (input.slug === EMPRESA_B_SLUG && input.isDevelopment) return "dev_empresa_b";
  return "none";
}

/** Publicação em produção exige empresa ativa + branding PUBLICADO + domínio ativo/verificado. */
export function canPublishTenantSite(input: {
  isDevelopment: boolean;
  empresaStatus: string;
  empresaAtivo: boolean;
  brandingStatus: "RASCUNHO" | "PUBLICADO" | null;
  dominioAtivo: boolean;
  dominioVerificado: boolean;
}): boolean {
  if (input.isDevelopment) {
    // Em development, rascunho pode ser previewado via override — não "publica" em produção.
    return true;
  }
  if (input.empresaStatus !== "ativo" || !input.empresaAtivo) return false;
  if (input.brandingStatus !== "PUBLICADO") return false;
  if (!input.dominioAtivo || !input.dominioVerificado) return false;
  return true;
}

/** Contatos/SEO/cores nunca são mesclados entre tenants. */
export function assertNoCrossTenantBrandingMerge(
  sourceSlug: string,
  targetSlug: string,
): boolean {
  return sourceSlug === targetSlug;
}
