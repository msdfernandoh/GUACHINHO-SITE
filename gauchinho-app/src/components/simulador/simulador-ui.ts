import { cn } from "@/lib/utils/cn";

export const simuladorShell = "min-h-screen bg-gradient-to-b from-[#0a1628] via-[#070d18] to-[#030508] text-slate-100";

export function stepBadgeClass(active = true) {
  return cn(
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
    active ? "bg-amber-400 text-slate-950" : "bg-slate-800 text-slate-400",
  );
}

export function choiceCardClass(selected: boolean, className?: string) {
  return cn(
    "rounded-2xl border p-4 text-left transition-all duration-200",
    "min-h-[4.5rem] shadow-lg shadow-black/20",
    selected
      ? "border-amber-400/80 bg-amber-400 text-slate-950 ring-2 ring-amber-300/60"
      : "border-slate-700/80 bg-slate-900/70 text-slate-100 hover:border-slate-600",
    className,
  );
}

export function sectionCardClass(className?: string) {
  return cn(
    "rounded-2xl border border-slate-700/60 bg-slate-900/50 p-5 shadow-xl shadow-black/25 sm:p-6",
    className,
  );
}

export function fieldHelpClass() {
  return "mt-1 text-xs leading-relaxed text-slate-400";
}
