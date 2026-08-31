import type { CSSProperties } from "react";
import type { Metadata } from "next";
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
  const allowsOperational = tenant?.allowsLegacyOperationalData === true;
  const usaChromeRacon = tenant?.siteModel?.codigo === "racon_inspired";
  const isGauchinho = tenant?.slug === GAUCHINHO_SLUG;
  const identidadeRacon: RaconTemplateIdentidade = tenant?.siteModel ? {
    ...tenant.siteModel.identidadeVisual,
    ...(tenant.branding.cor_primaria ? { cor_primaria: tenant.branding.cor_primaria } : {}),
    ...(tenant.branding.cor_secundaria ? { cor_secundaria: tenant.branding.cor_secundaria } : {}),
    ...(tenant.branding.cor_destaque ? { cor_destaque: tenant.branding.cor_destaque } : {}),
  } : {};
  const logoRacon = tenant?.siteModel?.usarLogoPropria
    ? tenant.branding.logo_url
    : tenant?.siteModel?.logoPadraoUrl ?? tenant?.branding.logo_url;

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
  if (tenant?.branding.cor_primaria) brandStyle["--brand-blue"] = tenant.branding.cor_primaria;
  if (tenant?.branding.cor_secundaria) brandStyle["--brand-blue-mid"] = tenant.branding.cor_secundaria;
  if (tenant?.branding.cor_destaque) {
    brandStyle["--brand-gold"] = tenant.branding.cor_destaque;
    brandStyle["--color-brand-gold"] = tenant.branding.cor_destaque;
  }

  // IA e JSON-LD operacional: só Gauchinho
  const iaConfig = allowsOperational && isGauchinho ? await getIaConfigPublic() : null;

  const brandValue = {
    nome: tenant?.branding.nome_site || "Gauchinho Consórcios",
    slug: tenant?.slug || GAUCHINHO_SLUG,
    logoUrl: logoRacon || tenant?.branding.logo_url || null,
    corPrimaria: tenant?.branding.cor_primaria || String(identidadeRacon.cor_primaria || "#0066cc"),
    corSecundaria: tenant?.branding.cor_secundaria || String(identidadeRacon.cor_secundaria || "#0c2340"),
    corDestaque: tenant?.branding.cor_destaque || String(identidadeRacon.cor_destaque || "#0099dd"),
    isGauchinho,
    isRacon: usaChromeRacon,
  };

  return (
    <LenisProvider>
      {allowsOperational ? <PublicJsonLd /> : null}
      <TenantBrandProvider value={brandValue}>
      <div className={usaChromeRacon ? "tenant-racon min-h-screen" : "min-h-screen text-zinc-100"} style={brandStyle}>
        {usaChromeRacon && tenant?.siteModel ? (
          <RaconInspiredHeader
            empresaNome={tenant.branding.nome_site}
            logoUrl={logoRacon}
            identidade={identidadeRacon}
            menus={tenant.siteModel.menus}
            telefoneContato={tenant.branding.telefone || "(41) 3000-0000"}
            whatsappContato={tenant.branding.whatsapp || "(41) 99999-9999"}
            footerCopyright={tenant.siteModel.footerCopyright}
          />
        ) : <PublicHeader />}
        {usaChromeRacon ? <SiteAppearance identity={identidadeRacon}>{children}</SiteAppearance> : children}
        {usaChromeRacon && tenant?.siteModel ? (
          <RaconInspiredFooter
            empresaNome={tenant.branding.nome_site}
            logoUrl={logoRacon}
            identidade={identidadeRacon}
            menus={tenant.siteModel.menus}
            telefoneContato={tenant.branding.telefone || "(41) 3000-0000"}
            whatsappContato={tenant.branding.whatsapp || "(41) 99999-9999"}
            footerCopyright={tenant.siteModel.footerCopyright}
          />
        ) : <PublicFooter />}
        {iaConfig ? <IaChatWidget config={iaConfig} /> : null}
      </div>
      </TenantBrandProvider>
    </LenisProvider>
  );
}
