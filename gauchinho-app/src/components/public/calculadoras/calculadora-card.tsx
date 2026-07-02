"use client";

import type { LucideIcon } from "lucide-react";
import {
  Calculator,
  LineChart,
  Landmark,
  Home,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { CalculadoraId } from "@/lib/calculadoras/types";
import type { CalculadoraMeta } from "@/lib/calculadoras/meta";

const TAB_ICONS: Record<CalculadoraId, LucideIcon> = {
  aplicacao_mensal: LineChart,
  valor_futuro: Calculator,
  financiamento: Landmark,
  correcao: Home,
  juros_real: Percent,
};

type Props = {
  meta: CalculadoraMeta;
  selected: boolean;
  onSelect: () => void;
  variant?: "sidebar" | "tab";
};

export function CalculadoraCard({ meta, selected, onSelect, variant = "sidebar" }: Props) {
  if (variant === "tab") {
    const Icon = TAB_ICONS[meta.id];
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all",
          "whitespace-nowrap shadow-md shadow-black/25",
          selected
            ? "border-amber-400 bg-gradient-to-b from-amber-400/20 to-amber-400/5 text-amber-50 ring-2 ring-amber-400/40"
            : "border-slate-700/80 bg-slate-900/90 text-slate-300 hover:border-slate-500 hover:bg-slate-800/80 hover:text-white",
        )}
      >
        <Icon className={cn("h-4 w-4 shrink-0", selected ? "text-amber-300" : "text-slate-500")} aria-hidden />
        {meta.title}
      </button>
    );
  }

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
