import "server-only";

import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { TENANT_EMPRESA_ID_HEADER, TENANT_SLUG_HEADER } from "@/lib/tenant/constants";
import { resolveTenantForRequest } from "@/lib/tenant/resolve-by-host";
import { resolvePartnerPublicRequest } from "@/lib/parceiros/public-site-loader";
import { FASE3_PARCEIRO_PUBLIC_SITE_ENABLED } from "@/lib/parceiros/constants";
import { resolveEmpresaIdForCatalog } from "./catalogo-autorizado";

/**
 * Empresa para catálogo comercial a partir do tenant do proxy (RSC/pages).
 * Nunca usa query/header do cliente como autoridade.
 */
export async function getCatalogEmpresaIdFromHeaders(): Promise<string | null> {
  const tenant = await getResolvedTenant();
  if (!tenant) return null;
  return resolveEmpresaIdForCatalog({
    empresaId: tenant.empresaId,
    slug: tenant.slug,
  });
}

/**
 * Route Handlers: Host → empresa (ignora x-tenant-* do Request).
 * Inclui domínio de parceiro → empresa da organização (concessões da franquia).
 */
export async function getCatalogEmpresaIdFromRequest(
  request: Request,
): Promise<string | null> {
  void request.headers.get(TENANT_EMPRESA_ID_HEADER);
  void request.headers.get(TENANT_SLUG_HEADER);

  const hostHeader = request.headers.get("host");
  const url = new URL(request.url);

  const resolved = await resolveTenantForRequest({
    hostHeader,
    searchParams: url.searchParams,
  });

  if (resolved.ok) {
    return resolveEmpresaIdForCatalog({
      empresaId: resolved.tenant.empresaId,
      slug: resolved.tenant.slug,
    });
  }

  if (FASE3_PARCEIRO_PUBLIC_SITE_ENABLED) {
    const partner = await resolvePartnerPublicRequest({
      hostHeader,
      pathname: url.pathname,
      searchParams: url.searchParams,
      mode: "public",
    });
    if (partner.ok) {
      return resolveEmpresaIdForCatalog({
        empresaId: partner.partner.empresa_id,
        slug: partner.partner.empresa_slug,
      });
    }
  }

  return null;
}
