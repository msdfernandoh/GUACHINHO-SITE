import Link from "next/link";

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-800/80 bg-zinc-950/90">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm text-zinc-500 sm:px-6 lg:grid-cols-[1fr_2fr]">
        <p>© {year} Gauchinho — Consórcios e soluções financeiras</p>
        <nav className="flex flex-wrap gap-x-4 gap-y-3 lg:justify-end" aria-label="Links institucionais e soluções">
          <Link href="/consorcio" className="hover:text-amber-400">
            Consórcios
          </Link>
          <Link href="/consorcio/imovel-parcela-reduzida" className="hover:text-amber-400">
            Consórcio de imóvel
          </Link>
          <Link href="/consorcio/caminhao-para-autonomo" className="hover:text-amber-400">
            Consórcio de caminhão
          </Link>
          <Link href="/consorcio/maquinas-agricolas" className="hover:text-amber-400">
            Máquinas agrícolas
          </Link>
          <Link href="/parceiros" className="hover:text-amber-400">
            Parceiros
          </Link>
          <Link href="/indicar" className="hover:text-amber-400">
            Indicar cliente
          </Link>
          <Link href="/perguntas-frequentes" className="hover:text-amber-400">
            Perguntas frequentes
          </Link>
        </nav>
      </div>
    </footer>
  );
}
