import { normalizeHost } from "./normalize";
import type { PartnerSiteResolution } from "./partner-site-types";

export type PartnerCanonicalInfo = {
  host_principal: string | null;
  alias_www: string | null;
  canonical_redirect: boolean;
  canal_principal: string;
  slug: string;
  /** URL canônica sugerida — E8 decide se redireciona. */
  canonical_url: string | null;
  path_sugerido: string;
};

/**
 * Prepara dados canônicos para E8. Não executa redirect.
 * Domínio próprio: apex armazenado; www é alias.
 */
export function buildPartnerCanonicalInfo(input: {
  site_slug: string;
  canal_principal: string;
  dominio_valor?: string | null;
  dominio_tipo?: string | null;
  principal_variant?: "apex" | "www";
  canonical_redirect?: boolean;
  path_prefix?: string;
}): PartnerCanonicalInfo {
  const path = `${input.path_prefix ?? "/parceiro"}/${input.site_slug}`.replace(
    /\/+/g,
    "/"
  );
  const apex = input.dominio_valor ? normalizeHost(input.dominio_valor) : null;
  const www = apex ? `www.${apex}` : null;
  const host_principal =
    apex && input.principal_variant === "www" ? www : apex;

  let canonical_url: string | null = null;
  if (input.canal_principal === "ROTA") {
    canonical_url = path;
  } else if (host_principal) {
    canonical_url = `https://${host_principal}/`;
  }

  return {
    host_principal,
    alias_www: input.dominio_tipo === "SUBDOMINIO_EMPRESA" ? null : www,
    canonical_redirect: input.canonical_redirect !== false,
    canal_principal: input.canal_principal,
    slug: input.site_slug,
    canonical_url,
    path_sugerido: path,
  };
}

export function canonicalInfoFromResolution(
  r: PartnerSiteResolution,
  principalVariant: "apex" | "www" = "apex"
): PartnerCanonicalInfo {
  return buildPartnerCanonicalInfo({
    site_slug: r.site_slug,
    canal_principal: r.canal_principal,
    dominio_valor: r.canonical_host,
    dominio_tipo: r.dominio_tipo,
    principal_variant: principalVariant,
    canonical_redirect: r.canonical_redirect,
  });
}
