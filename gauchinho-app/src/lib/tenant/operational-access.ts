/**
 * Regra central: o catálogo/site operacional é um entitlement explícito da empresa.
 * Não há exceção por slug ou UUID.
 */
export function tenantAllowsLegacyOperationalData(
  tenant: { operationalEnabled?: boolean } | boolean | null | undefined,
): boolean {
  if (typeof tenant === "boolean") return tenant;
  return tenant?.operationalEnabled === true;
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

/**
 * Áreas admin exclusivas PLATFORM_SUPERADMIN acessíveis em hosts de outros tenants.
 * Inclui empresas (SaaS) e catálogo global de administradoras (Fase 4 E3).
 */
export function isPlatformEmpresasAdminPath(pathname: string): boolean {
  return (
    pathname === "/admin/empresas" ||
    pathname.startsWith("/admin/empresas/") ||
    pathname === "/admin/administradoras" ||
    pathname.startsWith("/admin/administradoras/")
  );
}
