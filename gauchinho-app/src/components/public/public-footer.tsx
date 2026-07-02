import Link from "next/link";

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-800/80 bg-zinc-950/90">
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
