import { PublicLogo } from "@/components/public/public-logo";
import { PublicHeaderNav } from "@/components/public/public-header-nav";
import { getConfigJsonPublic, DEFAULT_SITE } from "@/server/config";
import { cn } from "@/lib/utils/cn";

type Props = {
  showNav?: boolean;
  className?: string;
};

export async function PublicHeader({ showNav = true, className }: Props) {
  const site = await getConfigJsonPublic("site", DEFAULT_SITE);
  const logoTitle = site.nomeEmpresa?.trim() || "GAUCHINHO";
  const logoSubtitle = site.subtitulo?.trim() || "Escritório de Soluções Financeiras";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/55",
        className,
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <PublicLogo
          href="/"
          logoUrl={site.logoUrl}
          title={logoTitle}
          subtitle={logoSubtitle}
        />
        {showNav ? <PublicHeaderNav /> : null}
      </div>
    </header>
  );
}
