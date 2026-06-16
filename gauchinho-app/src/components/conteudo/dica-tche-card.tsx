import Link from "next/link";
import Image from "next/image";
import type { DicaTche } from "@/lib/conteudo/types";
import { cn } from "@/lib/utils/cn";

export function DicaTcheCard({ dica, className }: { dica: DicaTche; className?: string }) {
  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-3xl border border-zinc-800/90 bg-zinc-950/80 shadow-xl shadow-black/20 transition hover:border-amber-500/35",
        className,
      )}
    >
      {dica.imagem_url ? (
        <div className="relative aspect-[16/10] w-full bg-zinc-900">
          <Image src={dica.imagem_url} alt="" fill className="object-cover" sizes="(max-width:768px) 100vw, 33vw" />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-6">
        {dica.categoria ? (
          <span className="text-xs font-bold uppercase tracking-wider text-amber-500">{dica.categoria}</span>
        ) : null}
        <h3 className="mt-2 text-lg font-bold text-white">{dica.titulo}</h3>
        {dica.descricao_curta ? (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-zinc-400">{dica.descricao_curta}</p>
        ) : null}
        <div className="mt-auto pt-6">
          <Link
            href={`/dicas-do-tche/${dica.slug}`}
            className="inline-flex rounded-full border border-amber-500/40 px-5 py-2.5 text-xs font-bold text-amber-300 hover:bg-amber-500/10"
          >
            Ler dica
          </Link>
        </div>
      </div>
    </article>
  );
}
