import { normalizeHost } from "@/lib/tenant/dominio";

/** Página de vendas para brasileiros nos EUA. */
export const EUA_LANDING_PATH = "/eua";

const EUA_SUBDOMAIN_PREFIX = "eua.";

/**
 * Para `eua.<dominio>` devolve o domínio pai, que é quem possui o tenant
 * (empresa_dominios ou parceiro_site_dominios). Qualquer outro host → null.
 * O subdomínio não precisa de cadastro próprio: herda a empresa do domínio pai.
 */
export function euaParentHost(rawHost: string | null | undefined): string | null {
  const host = normalizeHost(rawHost);
  if (!host.startsWith(EUA_SUBDOMAIN_PREFIX)) return null;
  const parent = host.slice(EUA_SUBDOMAIN_PREFIX.length);
  return parent.includes(".") ? parent : null;
}

/**
 * Host usado para resolver o tenant: o subdomínio EUA vale como o domínio pai.
 * Usado no proxy e nas re-resoluções server-side das APIs públicas.
 */
export function hostParaResolucaoTenant(rawHost: string | null): string | null {
  return euaParentHost(rawHost) ?? rawHost;
}

/** No subdomínio EUA a raiz exibe a página de vendas; demais rotas seguem normais. */
export function euaLandingRewritePath(pathname: string): string | null {
  return pathname === "/" || pathname === "" ? EUA_LANDING_PATH : null;
}
