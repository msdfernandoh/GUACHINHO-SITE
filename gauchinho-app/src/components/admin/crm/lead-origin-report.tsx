import type { OrigemReportRow } from "@/lib/crm/reports";
import { formatCurrency } from "@/lib/utils/format";

export function LeadOriginReport({ rows }: { rows: OrigemReportRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="min-w-full text-sm">
        <thead className="bg-zinc-950/80 text-left text-[10px] uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-2">Origem</th>
            <th className="px-3 py-2">Leads</th>
            <th className="px-3 py-2">Qualificados</th>
            <th className="px-3 py-2">Propostas</th>
            <th className="px-3 py-2">Fechados</th>
            <th className="px-3 py-2">Perdidos</th>
            <th className="px-3 py-2">Valor potencial</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.origem} className="border-t border-zinc-800">
              <td className="px-3 py-2 font-medium text-zinc-200">{r.label}</td>
              <td className="px-3 py-2">{r.leads}</td>
              <td className="px-3 py-2">{r.qualificados}</td>
              <td className="px-3 py-2">{r.propostas}</td>
              <td className="px-3 py-2">{r.fechados}</td>
              <td className="px-3 py-2">{r.perdidos}</td>
              <td className="px-3 py-2">{formatCurrency(r.valorPotencial)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
