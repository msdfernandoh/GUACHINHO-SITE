import type { CSSProperties } from "react";
import { isRaconModel } from "@/lib/tenant/model-family";
import { resolveSiteContacts } from "@/lib/tenant/site-contacts";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { LenisProvider } from "@/components/public/lenis-provider";
import { IaChatWidget } from "@/components/public/ia-chat/ia-chat-widget";
import { PublicJsonLd } from "@/components/public/seo/public-json-ld";
import { getIaConfigPublic } from "@/server/config";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { RaconInspiredFooter, RaconInspiredHeader } from "@/components/public/templates/racon-inspired-chrome";
import { TenantBrandProvider } from "@/components/tenant/tenant-brand-context";
import { GAUCHINHO_SLUG } from "@/lib/tenant/constants";
import { SiteAppearance } from "@/components/public/site-appearance";
import type { RaconTemplateIdentidade } from "@/components/public/templates/racon-inspired-home";
import { loadPartnerSiteViewModel } from "@/lib/parceiros/public-site-loader";
import { PARCEIRO_SITE_ID_HEADER } from "@/lib/parceiros/partner-site-types";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getResolvedTenant();
  if (!tenant) return {};
  const metadata: Metadata = {};
  if (tenant.branding.seo_titulo) metadata.title = tenant.branding.seo_titulo;
  if (tenant.branding.seo_descricao) metadata.description = tenant.branding.seo_descricao;
  // Tenant institucional: não herdar OpenGraph/SEO operacional da Gauchinho no layout.
  if (!tenant.allowsLegacyOperationalData && tenant.branding.nome_site) {
    metadata.title = tenant.branding.seo_titulo || tenant.branding.nome_site;
    metadata.description =
      tenant.branding.seo_descricao || tenant.branding.descricao_institucional || undefined;
  }
  return metadata;
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getResolvedTenant();
  const requestHeaders = await headers();
  const partnerSiteId = requestHeaders.get(PARCEIRO_SITE_ID_HEADER);
  const partnerView = partnerSiteId && tenant
    ? await loadPartnerSiteViewModel({ siteId: partnerSiteId, empresaId: tenant.empresaId })
    : null;
  const allowsOperational = tenant?.allowsLegacyOperationalData === true;
  const usaChromeRacon = partnerView?.template_codigo === "racon_inspired" || isRaconModel(tenant?.siteModel);
  // Um site parceiro compartilha apenas o ERP da empresa proprietaria. A sua
  // identidade publica (modelo, cores, nome, logo e recursos de marca) e
  // independente e nunca pode herdar a marca da empresa do ERP.
  const isPartnerSite = Boolean(partnerView);
  const isGauchinho = !isPartnerSite && tenant?.slug === GAUCHINHO_SLUG;
  const identidadeRacon: RaconTemplateIdentidade = partnerView
    ? partnerView.modelo_identidade as RaconTemplateIdentidade
    : tenant?.siteModel ? {
    ...tenant.siteModel.identidadeVisual,
    ...(tenant.branding.cor_primaria ? { cor_primaria: tenant.branding.cor_primaria } : {}),
    ...(tenant.branding.cor_secundaria ? { cor_secundaria: tenant.branding.cor_secundaria } : {}),
    ...(tenant.branding.cor_destaque ? { cor_destaque: tenant.branding.cor_destaque } : {}),
  } : {};
  const logoRacon = partnerView
    ? partnerView.logo_url ?? partnerView.modelo_logo_padrao_url
    : tenant?.siteModel?.usarLogoPropria
    ? tenant.branding.logo_url
    : tenant?.siteModel?.logoPadraoUrl ?? tenant?.branding.logo_url;
  const contatos = partnerView
    ? { telefone: partnerView.contato.telefone, whatsapp: partnerView.contato.whatsapp }
    : resolveSiteContacts(tenant?.branding || {}, identidadeRacon.contatos);
  const nomeSite = partnerView?.nome_site ?? tenant?.branding.nome_site ?? "Gauchinho Consórcios";
  const menusRacon = partnerView?.modelo_menus ?? tenant?.siteModel?.menus ?? [];
  const footerRacon = partnerView?.modelo_footer_copyright ?? tenant?.siteModel?.footerCopyright ?? undefined;

  const brandStyle: CSSProperties & Record<string, string> = {
    background: usaChromeRacon ? String(identidadeRacon.cor_fundo || "#ffffff") : "var(--brand-blue)",
    color: usaChromeRacon ? String(identidadeRacon.cor_texto || "#0f172a") : "#f4f4f5",
  };
  if (usaChromeRacon) {
    brandStyle["--tenant-primary"] = String(identidadeRacon.cor_primaria || "#0066cc");
    brandStyle["--tenant-secondary"] = String(identidadeRacon.cor_secundaria || "#0066cc");
    brandStyle["--tenant-accent"] = String(identidadeRacon.cor_destaque || "#0099dd");
    brandStyle["--visual-bg"] = String(identidadeRacon.cor_fundo || "#ffffff");
    brandStyle["--visual-title"] = String(identidadeRacon.cor_texto || "#0f172a");
    brandStyle["--visual-text"] = String(identidadeRacon.cor_texto || "#334155");
    brandStyle["--visual-button"] = String(identidadeRacon.cor_primaria || "#0066cc");
    brandStyle["--visual-button-text"] = "#ffffff";
    brandStyle["--visual-accent"] = String(identidadeRacon.cor_primaria || "#0066cc");
  }
  if (!isPartnerSite && tenant?.branding.cor_primaria) brandStyle["--brand-blue"] = tenant.branding.cor_primaria;
  if (!isPartnerSite && tenant?.branding.cor_secundaria) brandStyle["--brand-blue-mid"] = tenant.branding.cor_secundaria;
  if (!isPartnerSite && tenant?.branding.cor_destaque) {
    brandStyle["--brand-gold"] = tenant.branding.cor_destaque;
    brandStyle["--color-brand-gold"] = tenant.branding.cor_destaque;
  }

  // IA e JSON-LD operacional: só Gauchinho
  const iaConfig = allowsOperational && isGauchinho ? await getIaConfigPublic() : null;

  const brandValue = {
    nome: nomeSite,
    slug: partnerView?.slug || tenant?.slug || GAUCHINHO_SLUG,
    logoUrl: logoRacon || (!isPartnerSite ? tenant?.branding.logo_url : null) || null,
    corPrimaria: isPartnerSite
      ? String(identidadeRacon.cor_primaria || "#0066cc")
      : tenant?.branding.cor_primaria || String(identidadeRacon.cor_primaria || "#0066cc"),
    corSecundaria: isPartnerSite
      ? String(identidadeRacon.cor_secundaria || "#0c2340")
      : tenant?.branding.cor_secundaria || String(identidadeRacon.cor_secundaria || "#0c2340"),
    corDestaque: isPartnerSite
      ? String(identidadeRacon.cor_destaque || "#0099dd")
      : tenant?.branding.cor_destaque || String(identidadeRacon.cor_destaque || "#0099dd"),
    isGauchinho,
    isRacon: usaChromeRacon,
  };

  return (
    <LenisProvider>
      {allowsOperational ? <PublicJsonLd /> : null}
      <TenantBrandProvider value={brandValue}>
      <div className={usaChromeRacon ? "tenant-racon min-h-screen" : "min-h-screen text-zinc-100"} style={brandStyle}>
        {usaChromeRacon && (tenant?.siteModel || partnerView) ? (
          <RaconInspiredHeader
            empresaNome={nomeSite}
            logoUrl={logoRacon}
            identidade={identidadeRacon}
            menus={menusRacon}
            telefoneContato={contatos.telefone ?? undefined}
            whatsappContato={contatos.whatsapp ?? undefined}
            footerCopyright={footerRacon}
          />
        ) : <PublicHeader />}
        {usaChromeRacon ? <SiteAppearance identity={identidadeRacon}>{children}</SiteAppearance> : children}
        {usaChromeRacon && (tenant?.siteModel || partnerView) ? (
          <RaconInspiredFooter
            empresaNome={nomeSite}
            logoUrl={logoRacon}
            identidade={identidadeRacon}
            menus={menusRacon}
            telefoneContato={contatos.telefone ?? undefined}
            whatsappContato={contatos.whatsapp ?? undefined}
            footerCopyright={footerRacon}
          />
        ) : <PublicFooter />}
        {iaConfig ? <IaChatWidget config={iaConfig} /> : null}
      </div>
      </TenantBrandProvider>
    </LenisProvider>
  );
}
