import "server-only";

import { headers } from "next/headers";
import { getEmpresaBrandingPublic, type EmpresaBranding } from "./branding";
import {
  TENANT_EMPRESA_ID_HEADER,
  TENANT_OPERATIONAL_ENABLED_HEADER,
  TENANT_SLUG_HEADER,
  GAUCHINHO_SLUG,
} from "./constants";
import { PARCEIRO_SITE_ID_HEADER } from "@/lib/parceiros/partner-site-types";
import { loadPartnerSiteViewModel } from "@/lib/parceiros/public-site-loader";
import { tenantAllowsLegacyOperationalData } from "./operational-access";
import { getEmpresaSiteModelPublic, type EmpresaSiteModel } from "./site-model";

export type ResolvedTenant = {
  empresaId: string;
  slug: string;
  branding: EmpresaBranding;
  siteModel: EmpresaSiteModel | null;
  allowsLegacyOperationalData: boolean;
  parceiroSiteId?: string | null;
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
  const parceiroSiteId = headerList.get(PARCEIRO_SITE_ID_HEADER);

  if (!empresaId || !slug) return null;

  const [branding, siteModel] = await Promise.all([
    getEmpresaBrandingPublic({ empresaId, slug }),
    getEmpresaSiteModelPublic(empresaId),
  ]);
  if (!branding) return null;

  let resolvedBranding = branding;
  let resolvedSiteModel = siteModel;

  if (parceiroSiteId) {
    try {
      const partnerView = await loadPartnerSiteViewModel({
        siteId: parceiroSiteId,
        empresaId,
      });
      if (partnerView) {
        resolvedBranding = {
          ...branding,
          nome_site: partnerView.nome_site || branding.nome_site,
          logo_url: partnerView.logo_url ?? branding.logo_url,
          cor_primaria: partnerView.cor_primaria || branding.cor_primaria,
          cor_secundaria: partnerView.cor_secundaria || branding.cor_secundaria,
          cor_destaque: partnerView.cor_destaque || branding.cor_destaque,
          telefone: partnerView.contato?.telefone || branding.telefone,
          whatsapp: partnerView.contato?.whatsapp || branding.whatsapp,
          email_contato: partnerView.contato?.email || branding.email_contato,
        };
        if (partnerView.template_codigo === "racon_inspired" || partnerView.site_id) {
          resolvedSiteModel = {
            id: partnerView.site_id || siteModel?.id || "",
            codigo: partnerView.template_codigo || siteModel?.codigo || "racon_inspired",
            layoutBase: partnerView.template_codigo === "racon_inspired" ? "racon_inspired" : siteModel?.layoutBase,
            nome: partnerView.nome_site,
            versao: siteModel?.versao ?? 1,
            identidadeVisual: partnerView.modelo_identidade || siteModel?.identidadeVisual || {},
            menus: (partnerView.modelo_menus as unknown as EmpresaSiteModel["menus"]) || siteModel?.menus || [],
            secoes: (partnerView.modelo_secoes as unknown as EmpresaSiteModel["secoes"]) || siteModel?.secoes || [],
            footerCopyright: partnerView.modelo_footer_copyright ?? siteModel?.footerCopyright ?? null,
            logoPadraoUrl: partnerView.modelo_logo_padrao_url ?? siteModel?.logoPadraoUrl ?? null,
            usarLogoPropria: Boolean(partnerView.logo_url),
          };
        }
      }
    } catch (e) {
      console.error("[getResolvedTenant] falha ao carregar identidade do parceiro:", e);
    }
  }

  return {
    empresaId,
    slug,
    branding: resolvedBranding,
    siteModel: resolvedSiteModel,
    allowsLegacyOperationalData: tenantAllowsLegacyOperationalData(operationalEnabled),
    parceiroSiteId: parceiroSiteId || null,
  };
}

/** Atalho tipado: true somente para slug gauchinho sem parceiro ativo. */
export function isGauchinhoTenant(tenant: { slug: string; parceiroSiteId?: string | null } | null | undefined): boolean {
  return !tenant?.parceiroSiteId && tenant?.slug === GAUCHINHO_SLUG;
}
