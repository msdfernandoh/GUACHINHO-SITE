"use client";

import { useMemo, useState } from "react";
import type { DicaTche } from "@/lib/conteudo/types";
import { DICA_CATEGORIAS } from "@/lib/conteudo/types";
import { DicaTcheCard } from "./dica-tche-card";
import { ConteudoCTA } from "./conteudo-cta";
import { ConteudoViewTracker } from "./conteudo-view-tracker";
import { cn } from "@/lib/utils/cn";

type Props = {
  dicas: DicaTche[];
  simuladorHref: string;
  whatsappHref: string;
};

export function DicasTchePublicClient({ dicas, simuladorHref, whatsappHref }: Props) {
  const [categoria, setCategoria] = useState("");
  const filtered = useMemo(
    () => (categoria ? dicas.filter((d) => d.categoria === categoria) : dicas),
    [dicas, categoria],
  );

  return (
    <>
      <ConteudoViewTracker tipo_evento="dica_visualizada" entidade_tipo="lista" />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex flex-wrap gap-2">
          <Chip active={!categoria} onClick={() => setCategoria("")}>
            Todas
          </Chip>
          {DICA_CATEGORIAS.map((c) => (
            <Chip key={c} active={categoria === c} onClick={() => setCategoria(c === categoria ? "" : c)}>
              {c}
            </Chip>
          ))}
        </div>
        {filtered.length === 0 ? (
          <p className="mt-10 text-sm text-zinc-500">Nenhuma dica publicada ainda. Volte em breve ou fale com um especialista.</p>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((d) => (
              <DicaTcheCard key={d.id} dica={d} />
            ))}
          </div>
        )}
        <div className="mt-16">
          <ConteudoCTA simuladorHref={simuladorHref} whatsappHref={whatsappHref} />
        </div>
      </div>
    </>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "bg-amber-500 text-zinc-950"
          : "border border-zinc-700 text-zinc-400 hover:border-amber-500/40",
      )}
    >
      {children}
    </button>
  );
}
