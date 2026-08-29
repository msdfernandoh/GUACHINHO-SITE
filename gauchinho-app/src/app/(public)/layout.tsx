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
  const identidadeRacon = tenant?.siteModel ? {
    ...tenant.siteModel.identidadeVisual,
    ...(tenant.branding.cor_primaria ? { cor_primaria: tenant.branding.cor_primaria } : {}),
    ...(tenant.branding.cor_secundaria ? { cor_secundaria: tenant.branding.cor_secundaria } : {}),
    ...(tenant.branding.cor_destaque ? { cor_destaque: tenant.branding.cor_destaque } : {}),
  } : {};
  const logoRacon = tenant?.siteModel?.usarLogoPropria
    ? tenant.branding.logo_url
    : tenant?.siteModel?.logoPadraoUrl ?? tenant?.branding.logo_url;

  const brandStyle: CSSProperties & Record<string, string> = { background: "var(--brand-blue)" };
  if (tenant?.branding.cor_primaria) brandStyle["--brand-blue"] = tenant.branding.cor_primaria;
  if (tenant?.branding.cor_secundaria) brandStyle["--brand-blue-mid"] = tenant.branding.cor_secundaria;
  if (tenant?.branding.cor_destaque) {
    brandStyle["--brand-gold"] = tenant.branding.cor_destaque;
    brandStyle["--color-brand-gold"] = tenant.branding.cor_destaque;
  }

  // IA e JSON-LD operacional: só Gauchinho
  const iaConfig = allowsOperational ? await getIaConfigPublic() : null;

  return (
    <LenisProvider>
      {allowsOperational ? <PublicJsonLd /> : null}
      <div className="min-h-screen text-zinc-100" style={brandStyle}>
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
        {children}
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
    </LenisProvider>
  );
}
