import Image from "next/image";
import type { ParceiroInstitucional } from "@/lib/conteudo/types";
import { cn } from "@/lib/utils/cn";

export function ParceiroCard({ parceiro, className }: { parceiro: ParceiroInstitucional; className?: string }) {
  const local = [parceiro.cidade, parceiro.estado].filter(Boolean).join(" — ");
  const wa = parceiro.whatsapp?.replace(/\D/g, "");

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-2xl border border-zinc-800/90 bg-zinc-900/50 p-6 text-center shadow-lg shadow-black/20 transition hover:border-amber-500/35",
        className,
      )}
    >
      {parceiro.logo_url ? (
        <div className="relative mx-auto mb-4 h-12 w-32">
          <Image src={parceiro.logo_url} alt="" fill className="object-contain" />
        </div>
      ) : (
        <p className="text-lg font-bold text-white">{parceiro.nome}</p>
      )}
      {parceiro.logo_url ? <p className="mt-1 text-sm font-semibold text-zinc-200">{parceiro.nome}</p> : null}
      {parceiro.tipo ? (
        <p className="mt-1 text-[11px] uppercase tracking-wide text-zinc-500">{parceiro.tipo}</p>
      ) : null}
      {local ? <p className="mt-2 text-xs text-zinc-500">{local}</p> : null}
      {parceiro.descricao ? (
        <p className="mt-3 line-clamp-4 text-left text-sm text-zinc-400">{parceiro.descricao}</p>
      ) : null}
      <div className="mt-auto flex flex-wrap justify-center gap-2 pt-5">
        {parceiro.site_url ? (
          <a
            href={parceiro.site_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-zinc-600 px-4 py-2 text-xs font-bold text-zinc-200 hover:border-amber-500/40"
          >
            Site
          </a>
        ) : null}
        {wa ? (
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-emerald-600/90 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500"
          >
            WhatsApp
          </a>
        ) : null}
      </div>
    </article>
  );
}
