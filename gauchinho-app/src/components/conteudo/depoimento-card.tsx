import Image from "next/image";
import type { Depoimento } from "@/lib/conteudo/types";
import { cn } from "@/lib/utils/cn";

export function DepoimentoCard({ depoimento, className }: { depoimento: Depoimento; className?: string }) {
  const local = [depoimento.cidade, depoimento.estado].filter(Boolean).join(" — ");

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-2xl border border-zinc-800/90 bg-zinc-900/50 p-6 shadow-lg shadow-black/20",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        {depoimento.foto_url ? (
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-zinc-700">
            <Image src={depoimento.foto_url} alt="" fill className="object-cover" sizes="56px" />
          </div>
        ) : (
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-lg font-bold text-amber-400"
            aria-hidden
          >
            {depoimento.nome.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-bold text-white">{depoimento.nome}</p>
          {local ? <p className="text-xs text-zinc-500">{local}</p> : null}
          {depoimento.nota != null && depoimento.nota > 0 ? (
            <p className="mt-1 text-xs text-amber-400" aria-label={`Nota ${depoimento.nota} de 5`}>
              {"★".repeat(Math.min(5, Math.round(depoimento.nota)))}
            </p>
          ) : null}
        </div>
      </div>
      <p className="mt-4 flex-1 text-sm leading-relaxed text-zinc-300">&ldquo;{depoimento.texto}&rdquo;</p>
      {depoimento.tipo_interesse ? (
        <p className="mt-4 text-[11px] uppercase tracking-wide text-zinc-500">{depoimento.tipo_interesse}</p>
      ) : null}
    </article>
  );
}
