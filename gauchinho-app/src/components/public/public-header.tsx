import { PublicLogo } from "@/components/public/public-logo";
import { PublicHeaderNav } from "@/components/public/public-header-nav";
import { PublicHeaderWrapper } from "@/components/public/public-header-wrapper";
import { resolvePublicLogoText } from "@/lib/brand/public-logo-text";
import { getConfigJsonPublic, DEFAULT_SITE } from "@/server/config";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { GAUCHINHO_SLUG } from "@/lib/tenant/constants";

type Props = {
  showNav?: boolean;
  className?: string;
};

export async function PublicHeader({ showNav = true, className }: Props) {
  const tenant = await getResolvedTenant();

  // Fallback configuracoes_sistema legado: SOMENTE Gauchinho sem branding resolvido.
  let nomeEmpresa = "Gauchinho";
  let subtitulo = "";
  let logoUrl: string | undefined;

  if (tenant) {
    nomeEmpresa = tenant.branding.nome_site;
    subtitulo = tenant.branding.subtitulo;
    logoUrl = tenant.branding.logo_url ?? undefined;
  } else {
    // Sem tenant resolvido no header: mantém legado apenas no domínio Gauchinho
    // (em produção o proxy já teria retornado 404 para host desconhecido).
    const site = await getConfigJsonPublic("site", DEFAULT_SITE);
    nomeEmpresa = site.nomeEmpresa;
    subtitulo = site.subtitulo ?? "";
    logoUrl = site.logoUrl;
  }

  // Segurança: se por algum motivo o slug não for gauchinho e ainda assim
  // tentarmos herdar config legado, não usar nome/logo da Gauchinho.
  if (tenant && tenant.slug !== GAUCHINHO_SLUG) {
    nomeEmpresa = tenant.branding.nome_site;
    subtitulo = tenant.branding.subtitulo;
    logoUrl = tenant.branding.logo_url ?? undefined;
  }

  const { title: logoTitle, subtitle: logoSubtitle } = resolvePublicLogoText(
    nomeEmpresa,
    subtitulo,
  );

  const allowsOperational = tenant?.allowsLegacyOperationalData === true;

  return (
    <PublicHeaderWrapper className={className}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:gap-6 sm:px-6 md:gap-8 sm:py-4">
        <PublicLogo
          href="/"
          logoUrl={logoUrl}
          title={logoTitle}
          subtitle={logoSubtitle}
          className="shrink-0"
        />
        {showNav ? <PublicHeaderNav institutionalOnly={!allowsOperational} /> : null}
      </div>
    </PublicHeaderWrapper>
  );
}
