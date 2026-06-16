import Link from "next/link";
import { PublicLogo } from "@/components/public/public-logo";
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
        "border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-sm",
        className,
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:py-4">
        <PublicLogo
          href="/"
          logoUrl={site.logoUrl}
          title={logoTitle}
          subtitle={logoSubtitle}
        />
        {showNav ? (
          <nav
            className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-zinc-400 sm:text-sm"
            aria-label="Navegação principal"
          >
            <Link href="/simulador" className="transition hover:text-amber-400">
              Simulador
            </Link>
            <Link href="/grupos" className="transition hover:text-amber-400">
              Grupos
            </Link>
            <Link href="/cartas-contempladas" className="transition hover:text-amber-400">
              Cartas
            </Link>
            <Link
              href="/oportunidades-imobiliarias"
              className="transition hover:text-amber-400"
            >
              Imóveis
            </Link>
            <Link href="/login" className="text-zinc-500 transition hover:text-zinc-300">
              Admin
            </Link>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
