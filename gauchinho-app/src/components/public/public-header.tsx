import { PublicLogo } from "@/components/public/public-logo";
import { PublicHeaderNav } from "@/components/public/public-header-nav";
import { PublicHeaderWrapper } from "@/components/public/public-header-wrapper";
import { resolvePublicLogoText } from "@/lib/brand/public-logo-text";
import { getConfigJsonPublic, DEFAULT_SITE } from "@/server/config";

type Props = {
  showNav?: boolean;
  className?: string;
};

export async function PublicHeader({ showNav = true, className }: Props) {
  const site = await getConfigJsonPublic("site", DEFAULT_SITE);
  const { title: logoTitle, subtitle: logoSubtitle } = resolvePublicLogoText(
    site.nomeEmpresa,
    site.subtitulo,
  );

  return (
    <PublicHeaderWrapper className={className}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:gap-6 sm:px-6 md:gap-8 sm:py-4">
        <PublicLogo
          href="/"
          logoUrl={site.logoUrl}
          title={logoTitle}
          subtitle={logoSubtitle}
          className="min-w-0 shrink-0"
        />
        {showNav ? <PublicHeaderNav /> : null}
      </div>
    </PublicHeaderWrapper>
  );
}
