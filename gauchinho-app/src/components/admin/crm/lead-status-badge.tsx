import { cn } from "@/lib/utils/cn";

const STATUS_STYLES: Record<string, string> = {
  Novo: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  "Em atendimento": "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  Qualificado: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  "Proposta enviada": "bg-violet-500/15 text-violet-200 ring-violet-500/30",
  Negociação: "bg-orange-500/15 text-orange-200 ring-orange-500/30",
  Fechado: "bg-green-600/20 text-green-300 ring-green-500/40",
  Perdido: "bg-zinc-600/30 text-zinc-400 ring-zinc-500/30",
};

export function LeadStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1",
        STATUS_STYLES[status] ?? "bg-zinc-800 text-zinc-300 ring-zinc-600",
      )}
    >
      {status}
    </span>
  );
}
