import Link from "next/link";
import { isRaconModel } from "@/lib/tenant/model-family";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { AuthMascotBubble } from "@/components/public/auth-mascot-bubble";
import { PublicLogo } from "@/components/public/public-logo";
import { resolvePublicLogoText } from "@/lib/brand/public-logo-text";
import { getConfigJsonPublic, DEFAULT_SITE } from "@/server/config";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { GAUCHINHO_SLUG } from "@/lib/tenant/constants";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getResolvedTenant();

  let nomeEmpresa: string;
  let subtitulo: string;
  let logoUrl: string | undefined;

  if (tenant) {
    nomeEmpresa = tenant.branding.nome_site;
    subtitulo = tenant.branding.subtitulo;
    logoUrl = tenant.branding.logo_url ?? undefined;
  } else {
    const site = await getConfigJsonPublic("site", DEFAULT_SITE);
    nomeEmpresa = site.nomeEmpresa;
    subtitulo = site.subtitulo ?? "";
    logoUrl = site.logoUrl;
  }

  // Nunca herdar branding da Gauchinho para outro tenant
  if (tenant && tenant.slug !== GAUCHINHO_SLUG) {
    nomeEmpresa = tenant.branding.nome_site;
    subtitulo = tenant.branding.subtitulo;
    logoUrl = tenant.branding.logo_url ?? undefined;
  }

  const { title, subtitle } = resolvePublicLogoText(nomeEmpresa, subtitulo);
  const showMascot = !tenant || tenant.slug === GAUCHINHO_SLUG;
  const isRacon = isRaconModel(tenant?.siteModel);
  const primary = tenant?.branding.cor_primaria || "#0099dd";

  return (
    <div
      className={isRacon ? "flex min-h-screen flex-col bg-white text-slate-900" : "flex min-h-screen flex-col bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"}
      style={isRacon ? { "--tenant-primary": primary } as CSSProperties : undefined}
    >
      <div className="flex justify-center px-4 pt-6 sm:pt-8">
        <PublicLogo href="/" logoUrl={logoUrl} title={title} subtitle={subtitle} showMascot={showMascot} lightTheme={isRacon} />
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
      {showMascot ? <AuthMascotBubble /> : null}
      <p className="pb-6 text-center text-xs text-zinc-500">
        <Link href="/" className={isRacon ? "hover:text-[var(--tenant-primary)]" : "hover:text-amber-500"}>
          ← Voltar para o site
        </Link>
      </p>
    </div>
  );
}
