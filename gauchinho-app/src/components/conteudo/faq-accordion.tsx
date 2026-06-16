"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { PerguntaFrequente } from "@/lib/conteudo/types";

type Props = {
  items: PerguntaFrequente[];
  categorias: readonly string[];
};

export function FAQAccordion({ items, categorias }: Props) {
  const [categoria, setCategoria] = useState<string>("");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((item) => {
      if (categoria && item.categoria !== categoria) return false;
      if (!term) return true;
      return (
        item.pergunta.toLowerCase().includes(term) || item.resposta.toLowerCase().includes(term)
      );
    });
  }, [items, categoria, q]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-wrap gap-2">
          <FilterChip active={!categoria} onClick={() => setCategoria("")}>
            Todas
          </FilterChip>
          {categorias.map((c) => (
            <FilterChip key={c} active={categoria === c} onClick={() => setCategoria(c === categoria ? "" : c)}>
              {c}
            </FilterChip>
          ))}
        </div>
        <label className="block w-full md:max-w-xs">
          <span className="sr-only">Buscar</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar pergunta…"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-amber-500/50 focus:outline-none"
          />
        </label>
      </div>
      <div className="divide-y divide-zinc-800 rounded-2xl border border-zinc-800/90 bg-zinc-950/50">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500">Nenhuma pergunta encontrada.</p>
        ) : (
          filtered.map((item) => {
            const open = openId === item.id;
            return (
              <div key={item.id}>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-zinc-900/50"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : item.id)}
                >
                  <span>
                    {item.categoria ? (
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-amber-500">
                        {item.categoria}
                      </span>
                    ) : null}
                    <span className="font-semibold text-white">{item.pergunta}</span>
                  </span>
                  <span className="shrink-0 text-amber-400">{open ? "−" : "+"}</span>
                </button>
                {open ? (
                  <div className="border-t border-zinc-800/80 px-5 py-4 text-sm leading-relaxed text-zinc-400">
                    {item.resposta}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function FilterChip({
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
          : "border border-zinc-700 text-zinc-400 hover:border-amber-500/40 hover:text-amber-300",
      )}
    >
      {children}
    </button>
  );
}
