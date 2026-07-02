"use client";

import Image from "next/image";
import type { SeguradoraRow } from "@/lib/seguradoras/types";

function waHref(num: string | null) {
  const d = num?.replace(/\D/g, "");
  if (!d) return null;
  return `https://wa.me/${d}`;
}

export function SeguradorasPublicClient({ seguradoras }: { seguradoras: SeguradoraRow[] }) {
  if (!seguradoras.length) {
    return (
      <p className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-6 py-12 text-center text-zinc-400">
        Nenhuma seguradora publicada no momento.
      </p>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {seguradoras.map((s) => {
        const wa = waHref(s.whatsapp);
        return (
          <article
            key={s.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60"
          >
            {s.imagem_url ? (
              <div className="relative h-32 w-full bg-zinc-800">
                <Image src={s.imagem_url} alt="" fill className="object-cover" sizes="400px" />
              </div>
            ) : null}
            <div className="flex flex-1 flex-col gap-3 p-5">
              <div className="flex items-start gap-3">
                {s.logo_url ? (
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white">
                    <Image src={s.logo_url} alt="" fill className="object-contain p-1" sizes="48px" />
                  </div>
                ) : null}
                <div>
                  <h2 className="text-lg font-bold text-white">{s.nome}</h2>
                  {s.cidade ? <p className="text-sm text-zinc-400">{s.cidade}{s.estado ? ` — ${s.estado}` : ""}</p> : null}
                </div>
              </div>
              {s.descricao ? <p className="text-sm leading-relaxed text-zinc-300 line-clamp-4">{s.descricao}</p> : null}
              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                {s.site_url ? (
                  <a
                    href={s.site_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-amber-500/50"
                  >
                    Site
                  </a>
                ) : null}
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500"
                  >
                    WhatsApp
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
