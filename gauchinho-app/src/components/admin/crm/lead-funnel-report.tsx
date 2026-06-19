import type { FunnelReportRow } from "@/lib/crm/reports";
import { formatCurrency } from "@/lib/utils/format";

export function LeadFunnelReport({ rows }: { rows: FunnelReportRow[] }) {
  const max = Math.max(...rows.map((r) => r.quantidade), 1);
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.status} className="flex items-center gap-3 text-sm">
          <span className="w-36 shrink-0 text-zinc-400">{r.status}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-amber-500/80"
              style={{ width: `${(r.quantidade / max) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right font-medium text-zinc-200">{r.quantidade}</span>
          <span className="hidden w-28 text-right text-xs text-zinc-500 sm:inline">
            {formatCurrency(r.valorPotencial)}
          </span>
        </div>
      ))}
    </div>
  );
}
