"use client";

import { cn } from "@/lib/utils/cn";
import { sectionCardClass } from "@/components/simulador/simulador-ui";

export type ResultRow = { label: string; value: string; highlight?: boolean };

type Props = {
  title?: string;
  rows: ResultRow[];
  extra?: React.ReactNode;
  /** Valor principal no topo (ex.: valor final). */
  heroMetric?: { label: string; value: string };
  variant?: "default" | "accent" | "sell";
  className?: string;
};

export function CalculatorResultCard({
  title = "Resultado",
  rows,
  extra,
  heroMetric,
  variant = "default",
  className,
}: Props) {
  const filteredRows = heroMetric
    ? rows.filter((r) => r.label !== heroMetric.label)
    : rows;

  return (
    <section
      className={cn(
        sectionCardClass(
          cn(
            "p-5 shadow-lg shadow-black/25 sm:p-6",
            variant === "default" && "border-amber-500/25",
            variant === "accent" && "border-amber-400/40 bg-slate-900/80",
            variant === "sell" &&
              "border-amber-400/55 bg-gradient-to-br from-amber-500/10 via-slate-900/90 to-slate-950 ring-1 ring-amber-400/20",
          ),
        ),
        className,
      )}
    >
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400/95">{title}</p>

      {heroMetric ? (
        <div className="mt-5 rounded-2xl border border-amber-400/30 bg-slate-950/50 px-4 py-5 text-center sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{heroMetric.label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-amber-400 sm:text-4xl">
            {heroMetric.value}
          </p>
        </div>
      ) : null}

      <dl className={cn("space-y-3.5", heroMetric ? "mt-5" : "mt-4")}>
        {filteredRows.map((row) => (
          <div
            key={row.label}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-slate-800/80 pb-3 last:border-0 last:pb-0"
          >
            <dt className="text-sm text-slate-400">{row.label}</dt>
            <dd
              className={
                row.highlight
                  ? "text-xl font-extrabold text-amber-400"
                  : "text-base font-bold text-white sm:text-lg"
              }
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {extra ? <div className="mt-5 border-t border-slate-700/60 pt-4">{extra}</div> : null}
    </section>
  );
}
