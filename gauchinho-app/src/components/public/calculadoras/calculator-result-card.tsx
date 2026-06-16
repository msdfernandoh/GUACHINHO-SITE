"use client";

import { sectionCardClass } from "@/components/simulador/simulador-ui";

export type ResultRow = { label: string; value: string; highlight?: boolean };

type Props = {
  title?: string;
  rows: ResultRow[];
  extra?: React.ReactNode;
};

export function CalculatorResultCard({ title = "Resultado", rows, extra }: Props) {
  return (
    <section className={sectionCardClass("border-amber-500/30")}>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">{title}</p>
      <dl className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-sm text-slate-400">{row.label}</dt>
            <dd
              className={
                row.highlight
                  ? "text-xl font-extrabold text-amber-400"
                  : "text-lg font-bold text-white"
              }
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {extra ? <div className="mt-4 border-t border-slate-700/60 pt-4">{extra}</div> : null}
    </section>
  );
}
