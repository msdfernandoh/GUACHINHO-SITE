"use client";

import type { Step } from "./contratacao-wizard-steps";
import { stepProgressIndex, WIZARD_STEPS } from "./contratacao-wizard-steps";
import { cn } from "@/lib/utils/cn";

export function ContratacaoWizardProgress({ step }: { step: Step }) {
  const current = stepProgressIndex(step);
  const total = WIZARD_STEPS.length;
  const pct = Math.round(((current + 1) / total) * 100);
  const currentMeta = WIZARD_STEPS[current];

  return (
    <div className="space-y-3">
      <div className="sm:hidden">
        <p className="text-center text-xs font-medium text-slate-400">
          Etapa {current + 1} de {total} —{" "}
          <span className="text-amber-300">{currentMeta?.label}</span>
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="hidden sm:block">
        <div className="flex items-center justify-between gap-1">
          {WIZARD_STEPS.map((s, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <div key={s.id} className="flex min-w-0 flex-1 flex-col items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    done && "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50",
                    active && "bg-amber-500 text-zinc-950",
                    !done && !active && "bg-slate-800 text-slate-500",
                  )}
                >
                  {done ? "✓" : i + 1}
                </div>
                <span
                  className={cn(
                    "mt-1.5 max-w-[4.5rem] truncate text-center text-[10px] font-medium leading-tight",
                    active ? "text-amber-300" : done ? "text-slate-300" : "text-slate-600",
                  )}
                  title={s.label}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="relative mt-3 h-1 rounded-full bg-slate-800">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-amber-500/80 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
