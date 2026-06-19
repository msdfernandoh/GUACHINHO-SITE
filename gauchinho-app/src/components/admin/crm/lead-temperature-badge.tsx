import { cn } from "@/lib/utils/cn";

const STYLES: Record<string, string> = {
  Frio: "bg-slate-500/20 text-slate-300 ring-slate-500/40",
  Morno: "bg-yellow-500/20 text-yellow-200 ring-yellow-500/40",
  Quente: "bg-orange-500/25 text-orange-200 ring-orange-500/50",
  "Muito quente": "bg-gradient-to-r from-red-500/30 to-amber-500/30 text-amber-100 ring-amber-400/50",
};

export function LeadTemperatureBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-xs text-zinc-500">—</span>;
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1",
        STYLES[value] ?? "bg-zinc-800 text-zinc-300 ring-zinc-600",
      )}
    >
      {value}
    </span>
  );
}
