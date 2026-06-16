"use client";

import { cn } from "@/lib/utils/cn";
import type { CalculadoraMeta } from "@/lib/calculadoras/meta";

type Props = {
  meta: CalculadoraMeta;
  selected: boolean;
  onSelect: () => void;
};

export function CalculadoraCard({ meta, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border p-4 text-left transition-all",
        "min-h-[5rem] shadow-lg shadow-black/20",
        selected
          ? "border-amber-400/80 bg-amber-400/15 ring-2 ring-amber-400/40"
          : "border-slate-700/80 bg-slate-900/70 hover:border-slate-600",
      )}
    >
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-400/90">{meta.title}</p>
      <p className="mt-1 text-sm font-semibold leading-snug text-white">{meta.question}</p>
      <p className="mt-2 text-xs text-slate-400">{meta.description}</p>
    </button>
  );
}
