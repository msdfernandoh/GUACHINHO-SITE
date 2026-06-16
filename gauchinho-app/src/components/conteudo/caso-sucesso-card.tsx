import Link from "next/link";
import Image from "next/image";
import type { CasoSucesso } from "@/lib/conteudo/types";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type Props = {
  caso: CasoSucesso;
  featured?: boolean;
  className?: string;
};

export function CasoSucessoCard({ caso, featured, className }: Props) {
  const local =
    [caso.cidade, caso.estado].filter(Boolean).join(" — ") || null;

  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-3xl border border-zinc-800/90 bg-zinc-950/80 shadow-xl shadow-black/20 transition hover:border-amber-500/35",
        featured && "ring-1 ring-amber-500/30",
        className,
      )}
    >
      {caso.imagem_url ? (
        <div className="relative aspect-[16/10] w-full bg-zinc-900">
          <Image src={caso.imagem_url} alt="" fill className="object-cover" sizes="(max-width:768px) 100vw, 33vw" />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center gap-2">
          {caso.categoria ? (
            <span className="text-xs font-bold uppercase tracking-wider text-amber-500">{caso.categoria}</span>
          ) : null}
          {featured ? (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
              Destaque
            </span>
          ) : null}
        </div>
        <h3 className="mt-2 text-lg font-bold text-white">{caso.titulo}</h3>
        {local ? <p className="mt-1 text-sm text-zinc-500">{local}</p> : null}
        {caso.descricao_curta ? (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-zinc-400">{caso.descricao_curta}</p>
        ) : null}
        {caso.valor_credito != null ? (
          <p className="mt-4 text-sm text-zinc-500">
            Crédito orientativo:{" "}
            <span className="font-semibold text-amber-400">{formatCurrency(Number(caso.valor_credito))}</span>
          </p>
        ) : null}
        <div className="mt-auto pt-6">
          <Link
            href={`/casos-de-sucesso/${caso.slug}`}
            className="inline-flex rounded-full bg-gradient-to-r from-amber-400 to-amber-600 px-5 py-2.5 text-xs font-bold text-zinc-950 hover:brightness-105"
          >
            Ler história
          </Link>
        </div>
      </div>
    </article>
  );
}
