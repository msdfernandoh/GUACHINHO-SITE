import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { LenisProvider } from "@/components/public/lenis-provider";
import { IaChatWidget } from "@/components/public/ia-chat/ia-chat-widget";
import { PublicJsonLd } from "@/components/public/seo/public-json-ld";
import { getIaConfigPublic } from "@/server/config";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";

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
        <PublicHeader />
        {children}
        <PublicFooter />
        {iaConfig ? <IaChatWidget config={iaConfig} /> : null}
      </div>
    </LenisProvider>
  );
}
