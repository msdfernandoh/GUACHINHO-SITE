import "server-only";

import { headers } from "next/headers";
import { getEmpresaBrandingPublic, type EmpresaBranding } from "./branding";
import {
  TENANT_EMPRESA_ID_HEADER,
  TENANT_OPERATIONAL_ENABLED_HEADER,
  TENANT_SLUG_HEADER,
  GAUCHINHO_SLUG,
} from "./constants";
import { tenantAllowsLegacyOperationalData } from "./operational-access";
import { getEmpresaSiteModelPublic, type EmpresaSiteModel } from "./site-model";

export type ResolvedTenant = {
  empresaId: string;
  slug: string;
  branding: EmpresaBranding;
  siteModel: EmpresaSiteModel | null;
  allowsLegacyOperationalData: boolean;
};

/**
 * Lê o tenant resolvido pelo proxy (headers internos).
 * NÃO faz fallback genérico para a Gauchinho quando o header está ausente —
 * isso evitava vazamento e mascarava falhas de resolução.
 */
export async function getResolvedTenant(): Promise<ResolvedTenant | null> {
  const headerList = await headers();
  const empresaId = headerList.get(TENANT_EMPRESA_ID_HEADER);
  const slug = headerList.get(TENANT_SLUG_HEADER);
  const operationalEnabled = headerList.get(TENANT_OPERATIONAL_ENABLED_HEADER) === "true";

  if (!empresaId || !slug) return null;

  const [branding, siteModel] = await Promise.all([
    getEmpresaBrandingPublic({ empresaId, slug }),
    getEmpresaSiteModelPublic(empresaId),
  ]);
  if (!branding) return null;

  return {
    empresaId,
    slug,
    branding,
    siteModel,
    allowsLegacyOperationalData: tenantAllowsLegacyOperationalData(operationalEnabled),
  };
}

/** Atalho tipado: true somente para slug gauchinho. */
export function isGauchinhoTenant(tenant: { slug: string } | null | undefined): boolean {
  return tenant?.slug === GAUCHINHO_SLUG;
}
