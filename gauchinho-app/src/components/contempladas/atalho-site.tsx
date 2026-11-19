import Link from "next/link";

/** Faixa no topo da home do site com o acesso ao portal de contempladas. */
export function AtalhoContempladas() {
  return (
    <div className="w-full bg-[#0c2340] text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <p className="text-sm font-semibold">
          <span className="mr-2 rounded-full bg-[#ffb800] px-2 py-0.5 text-[11px] font-black uppercase text-[#0c2340]">Novo</span>
          Portal de Cotas Contempladas: cartas prontas, junção, propostas e reserva online.
        </p>
        <Link href="/contempladas" className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#0c2340] hover:bg-slate-100">
          Acessar o portal
        </Link>
      </div>
    </div>
  );
}
