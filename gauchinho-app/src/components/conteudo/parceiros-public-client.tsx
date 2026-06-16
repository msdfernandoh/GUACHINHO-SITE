"use client";

import { useMemo } from "react";
import type { ParceiroInstitucional } from "@/lib/conteudo/types";
import { PARCEIRO_TIPOS } from "@/lib/conteudo/types";
import { ParceiroCard } from "./parceiro-card";
import { ConteudoCTA } from "./conteudo-cta";
import { ConteudoViewTracker } from "./conteudo-view-tracker";

type Props = {
  parceiros: ParceiroInstitucional[];
  simuladorHref: string;
  whatsappHref: string;
};

export function ParceirosPublicClient({ parceiros, simuladorHref, whatsappHref }: Props) {
  const byTipo = useMemo(() => {
    const map = new Map<string, ParceiroInstitucional[]>();
    for (const p of parceiros) {
      const t = p.tipo || "Outros";
      const list = map.get(t) ?? [];
      list.push(p);
      map.set(t, list);
    }
    const order = [...PARCEIRO_TIPOS, "Outros"];
    return order
      .filter((t) => map.has(t))
      .map((t) => ({ tipo: t, items: map.get(t)! }));
  }, [parceiros]);

  return (
    <>
      <ConteudoViewTracker tipo_evento="parceiro_visualizado" entidade_tipo="lista" />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {parceiros.length === 0 ? (
          <p className="text-sm text-zinc-500">Parceiros em atualização. Nossa equipe comercial pode apresentar a rede institucional.</p>
        ) : (
          byTipo.map(({ tipo, items }) => (
            <section key={tipo} className="mb-14">
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-500">{tipo}</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((p) => (
                  <ParceiroCard key={p.id} parceiro={p} />
                ))}
              </div>
            </section>
          ))
        )}
        <ConteudoCTA simuladorHref={simuladorHref} whatsappHref={whatsappHref} />
      </div>
    </>
  );
}
