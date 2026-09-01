import { FASE3_PARCEIRO_PUBLIC_SITE_ENABLED } from "./constants";
import type { PartnerSiteResolution, ResolvePartnerSiteResult } from "./partner-site-types";
import { mayServePartnerPublicSite } from "./resolve-partner-site";

export type PublicServeDenial =
  | "flag_off"
  | "not_resolved"
  | "org_inativa"
  | "site_inativo"
  | "status_nao_publicado"
  | "domain_gate"
  | "ineligible";

/**
 * Gates públicos E8.
 * Rota /parceiro/[slug]: não exige domínio.
 * Domínio/subdomínio: exige ATIVO + verificado + SSL READY (já em public_eligible).
 */
export function evaluatePublicServeGate(input: {
  resolution: ResolvePartnerSiteResult;
  orgStatus?: string;
}): { ok: true; partner: PartnerSiteResolution } | { ok: false; reason: PublicServeDenial } {
  if (!FASE3_PARCEIRO_PUBLIC_SITE_ENABLED) {
    return { ok: false, reason: "flag_off" };
  }
  if (!input.resolution.ok) {
    return { ok: false, reason: "not_resolved" };
  }
  const p = input.resolution.partner;
  if (input.orgStatus && input.orgStatus !== "ATIVA") {
    return { ok: false, reason: "org_inativa" };
  }
  if (!p.site_ativo) return { ok: false, reason: "site_inativo" };
  if (p.status_publicacao !== "PUBLICADO") {
    return { ok: false, reason: "status_nao_publicado" };
  }
  if (!mayServePartnerPublicSite(input.resolution) || !p.public_eligible) {
    if (p.source !== "parceiro_path") {
      return { ok: false, reason: "domain_gate" };
    }
    // path: public_eligible já exige flag+PUBLICADO+ativo; se false, ineligible
    return { ok: false, reason: "ineligible" };
  }
  return { ok: true, partner: p };
}

/**
 * Regra canônica E8 (quando flag ligada):
 * 1) Host de domínio/alias/www ≠ host_principal e canonical_redirect → 308
 * 2) /parceiro/[slug] no tenant com domínio principal elegível + canonical_redirect
 *    → 308 para https://host_principal/
 * Nunca redireciona entre tenants.
 */
export function computeCanonicalRedirect(input: {
  requestedHost: string;
  requestedPath: string;
  partner: PartnerSiteResolution;
  principalVariant?: "apex" | "www";
}): { redirect: true; location: string; status: 308 } | { redirect: false } {
  if (!FASE3_PARCEIRO_PUBLIC_SITE_ENABLED) return { redirect: false };
  if (!input.partner.canonical_redirect) return { redirect: false };
  if (!input.partner.public_eligible) return { redirect: false };

  const principal = input.partner.canonical_host;
  if (!principal) return { redirect: false };

  const reqFull = (input.requestedHost.split(":")[0] ?? "").toLowerCase();
  const principalFull = principal.toLowerCase();

  if (input.partner.source !== "parceiro_path") {
    // A Vercel pode entregar ao runtime o host www já normalizado para o apex.
    // Quando www é a variante principal, o redirect apex → www pertence ao
    // provedor de domínio; repeti-lo aqui produziria um 308 para a própria URL.
    if (
      input.principalVariant === "www" &&
      principalFull.startsWith("www.") &&
      reqFull === principalFull.slice(4)
    ) {
      return { redirect: false };
    }
    if (reqFull && reqFull !== principalFull) {
      return { redirect: true, location: `https://${principal}/`, status: 308 };
    }
    return { redirect: false };
  }

  // Rota → domínio principal só se domínio ATIVO + verificado + SSL READY.
  if (
    input.partner.dominio_id &&
    input.partner.dominio_status === "ATIVO" &&
    input.partner.dominio_verificado &&
    input.partner.dominio_ssl_status === "READY" &&
    input.requestedPath.startsWith("/parceiro/")
  ) {
    return { redirect: true, location: `https://${principal}/`, status: 308 };
  }

  return { redirect: false };
}

export function robotsForPartnerStatus(
  status: string,
  isPreview: boolean
): { index: boolean; follow: boolean } {
  // Deployments de preview Vercel nunca devem indexar, mesmo com site PUBLICADO.
  if (isPreview || process.env.VERCEL_ENV === "preview") {
    return { index: false, follow: false };
  }
  if (status === "PUBLICADO" && FASE3_PARCEIRO_PUBLIC_SITE_ENABLED) {
    return { index: true, follow: true };
  }
  return { index: false, follow: false };
}
