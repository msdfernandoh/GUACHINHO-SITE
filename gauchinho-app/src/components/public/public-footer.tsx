import Image from "next/image";
import Link from "next/link";
import type { FooterPartnerLogo } from "@/lib/footer/load-footer-partners";

export function PublicFooter({ partners }: { partners: FooterPartnerLogo[] }) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-800/80 bg-zinc-950/90">
      {partners.length > 0 ? (
        <section className="border-b border-zinc-800/60 px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <p className="mb-6 text-center text-xs font-bold uppercase tracking-[0.2em] text-amber-500/90">
              Parceiros
            </p>
            <ul className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
              {partners.map((p) => (
                <li key={p.id} className="flex max-w-[140px] flex-col items-center gap-2">
                  {p.logoUrl ? (
                    p.href ? (
                      <a href={p.href} target="_blank" rel="noopener noreferrer" className="block">
                        <span className="relative flex h-12 w-28 items-center justify-center rounded-lg bg-white/95 px-2 py-1">
                          <Image src={p.logoUrl} alt={p.nome} width={112} height={40} className="max-h-10 w-auto object-contain" />
                        </span>
                      </a>
                    ) : (
                      <span className="relative flex h-12 w-28 items-center justify-center rounded-lg bg-white/95 px-2 py-1">
                        <Image src={p.logoUrl} alt={p.nome} width={112} height={40} className="max-h-10 w-auto object-contain" />
                      </span>
                    )
                  ) : (
                    <span className="rounded-lg border border-zinc-700 px-3 py-2 text-center text-xs font-medium text-zinc-300">
                      {p.nome}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {year} Gauchinho — Consórcios e soluções financeiras</p>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/parceiros" className="hover:text-amber-400">
            Parceiros
          </Link>
          <Link href="/indicar" className="hover:text-amber-400">
            Indicar cliente
          </Link>
          <Link href="/perguntas-frequentes" className="hover:text-amber-400">
            FAQ
          </Link>
        </nav>
      </div>
    </footer>
  );
}
