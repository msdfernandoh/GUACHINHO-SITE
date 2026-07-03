"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import type { EventoRow } from "@/lib/comercial-eventos/types";
import { formatDateTime } from "@/lib/utils/format";

type Props = {
  evento: EventoRow;
};

export function EventoListCard({ evento }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(evento.imagem_capa_url?.trim()) && !imgFailed;

  return (
    <li className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/50 shadow-lg shadow-black/20 transition hover:border-amber-500/35">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={evento.imagem_capa_url!}
          alt=""
          className="h-44 w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div
          className="flex h-44 w-full flex-col items-center justify-center gap-2 border-b border-slate-800/80 bg-gradient-to-br from-slate-900 via-[#0a1628] to-slate-950 px-4 text-center"
          aria-hidden
        >
          <CalendarDays className="h-10 w-10 text-amber-500/50" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Evento Gauchinho</span>
        </div>
      )}
      <div className="p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
          {evento.data_evento ? formatDateTime(evento.data_evento, null) : "Data a confirmar"}
        </p>
        <h2 className="mt-2 text-lg font-bold text-white sm:text-xl">{evento.nome}</h2>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-400">
          {evento.descricao_curta ?? evento.cidade ?? evento.local ?? ""}
        </p>
        <Link
          href={`/eventos/${evento.slug}`}
          className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-amber-500/15 px-5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/25 active:scale-[0.98]"
        >
          Ver evento →
        </Link>
      </div>
    </li>
  );
}
