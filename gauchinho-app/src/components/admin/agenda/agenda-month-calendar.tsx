"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { StatusDiaCalendario } from "@/lib/agenda/disponibilidade";

const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

const STATUS_CLASS: Record<StatusDiaCalendario, string> = {
  livre: "bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-500/50 hover:bg-emerald-500/40",
  compromisso: "bg-amber-500/30 text-amber-50 ring-1 ring-amber-400/60 hover:bg-amber-500/45",
  bloqueado: "bg-red-500/30 text-red-100 ring-1 ring-red-500/50 hover:bg-red-500/45",
  vazio: "bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800",
};

type Props = {
  year: number;
  month: number;
  selected?: string | null;
  statusForDay: (dataIso: string) => StatusDiaCalendario;
  onSelectDay: (dataIso: string) => void;
  /** Navegação via URL (Agenda) — preferível para refetch no servidor. */
  prevHref?: string;
  nextHref?: string;
  /** Navegação client-side (Disponibilidade). */
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  size?: "md" | "lg";
  showLegend?: boolean;
};

export function AgendaMonthCalendar({
  year,
  month,
  selected,
  statusForDay,
  onSelectDay,
  prevHref,
  nextHref,
  onPrevMonth,
  onNextMonth,
  size = "lg",
  showLegend = true,
}: Props) {
  const totalDays = daysInMonth(year, month);
  const firstDow = new Date(year, month - 1, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  const cellPad = size === "lg" ? "min-h-[3.25rem] py-2.5 text-sm sm:min-h-[3.75rem] sm:text-base" : "min-h-[2.5rem] py-1.5 text-sm";

  const navBtnClass =
    "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-600 text-zinc-200 hover:border-amber-500/50 hover:text-amber-300";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {prevHref ? (
          <Link href={prevHref} className={navBtnClass} aria-label="Mês anterior">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        ) : (
          <button type="button" className={navBtnClass} onClick={onPrevMonth} aria-label="Mês anterior">
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <p className="text-center text-base font-semibold text-zinc-50 sm:text-lg">
          {MESES[month - 1]} {year}
        </p>
        {nextHref ? (
          <Link href={nextHref} className={navBtnClass} aria-label="Próximo mês">
            <ChevronRight className="h-5 w-5" />
          </Link>
        ) : (
          <button type="button" className={navBtnClass} onClick={onNextMonth} aria-label="Próximo mês">
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-zinc-500 sm:gap-1.5 sm:text-xs">
        {WEEK.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {cells.map((day, i) => {
          if (day == null) return <span key={`e-${i}`} className={cellPad} />;
          const key = `${year}-${pad(month)}-${pad(day)}`;
          const status = statusForDay(key);
          const active = key === selected;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(key)}
              className={`relative rounded-lg font-medium transition ${cellPad} ${STATUS_CLASS[status]} ${
                active ? "outline outline-2 outline-offset-1 outline-amber-400" : ""
              }`}
            >
              {day}
              {status === "compromisso" ? (
                <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-amber-300" />
              ) : null}
            </button>
          );
        })}
      </div>

      {showLegend ? (
        <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/80" /> Livre
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Compromisso
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> Bloqueado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-zinc-700" /> Sem horário
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function agendaMonthHref(year: number, month: number, extra?: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  q.set("mes", String(month));
  q.set("ano", String(year));
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) q.set(k, v);
    }
  }
  return `/admin/agenda?${q.toString()}`;
}
