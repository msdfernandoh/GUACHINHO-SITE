"use client";

import Link from "next/link";
import { registrarEventoClient } from "@/lib/eventos/registrar-client";

type Props = {
  simuladorHref: string;
  whatsappHref: string;
  simuladorLabel?: string;
  whatsappLabel?: string;
};

export function ConteudoCTA({
  simuladorHref,
  whatsappHref,
  simuladorLabel = "Simular meu objetivo",
  whatsappLabel = "Falar com especialista",
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800/90 bg-zinc-950/60 p-6 md:p-8">
      <Link
        href={simuladorHref}
        onClick={() => registrarEventoClient({ tipo_evento: "cta_conteudo_simulador", origem: "conteudo" })}
        className="inline-flex rounded-full bg-gradient-to-r from-amber-400 to-amber-600 px-6 py-3 text-sm font-bold text-zinc-950 hover:brightness-105"
      >
        {simuladorLabel}
      </Link>
      <a
        href={whatsappHref}
        target="_blank"
        rel="noreferrer"
        onClick={() => registrarEventoClient({ tipo_evento: "cta_conteudo_whatsapp", origem: "conteudo" })}
        className="inline-flex rounded-full border-2 border-amber-500/40 px-6 py-3 text-sm font-bold text-amber-300 hover:bg-amber-500/10"
      >
        {whatsappLabel}
      </a>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("gauchinho:open-ia-chat"))}
        className="text-sm font-semibold text-zinc-300 underline-offset-4 hover:text-amber-400 hover:underline"
      >
        Abrir assistente do site
      </button>
    </div>
  );
}
