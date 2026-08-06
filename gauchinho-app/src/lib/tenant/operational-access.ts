import { GAUCHINHO_SLUG } from "./constants";

/**
 * Regra central: dados operacionais legados só para a Gauchinho.
 */
export function tenantAllowsLegacyOperationalData(
  tenant: { slug: string } | string | null | undefined,
): boolean {
  if (!tenant) return false;
  const slug = typeof tenant === "string" ? tenant : tenant.slug;
  return slug === GAUCHINHO_SLUG;
}

/**
 * Rotas públicas que consultam/renderizam dados operacionais da Gauchinho.
 * NÃO inclui /admin — admin segue autenticação/autorização própria.
 */
export const LEGACY_OPERATIONAL_PATH_PREFIXES = [
  "/simulador",
  "/calculadoras",
  "/grupos",
  "/cartas-contempladas",
  "/oportunidades-imobiliarias",
  "/seguradoras",
  "/eventos",
  "/indicar",
  "/contratacao",
  "/contratar",
  "/proposta",
  "/parceiros",
  "/casos-de-sucesso",
  "/dicas-do-tche",
  "/lista-convidados",
  "/qr",
  "/home-v1",
  "/home-v2",
  "/consorcio",
  "/depoimentos",
] as const;

/**
 * Prefixo de APIs operacionais (dados globais Gauchinho).
 * Cron e OAuth callback são tratados à parte no proxy (skip gate / auth própria).
 */
export const LEGACY_OPERATIONAL_API_PREFIXES = [
  "/api/public",
  "/api/integration",
  "/api/ia",
  "/api/propostas",
  "/api/admin",
] as const;

export function isLegacyOperationalPath(pathname: string): boolean {
  if (pathname === "/") return false;
  return LEGACY_OPERATIONAL_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isLegacyOperationalApiPath(pathname: string): boolean {
  return LEGACY_OPERATIONAL_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export const INSTITUTIONAL_PUBLIC_LINKS = [{ href: "/", label: "Início" }] as const;

/** /admin/empresas é a única área admin multiempresa nesta fase (SuperAdmin). */
export function isPlatformEmpresasAdminPath(pathname: string): boolean {
  return pathname === "/admin/empresas" || pathname.startsWith("/admin/empresas/");
}
