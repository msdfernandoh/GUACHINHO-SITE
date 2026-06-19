import type { ConsultorReportRow } from "@/lib/crm/reports";
import { formatCurrency } from "@/lib/utils/format";

export function LeadConsultorReport({ rows }: { rows: ConsultorReportRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="min-w-full text-sm">
        <thead className="bg-zinc-950/80 text-left text-[10px] uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-2">Consultor</th>
            <th className="px-3 py-2">Recebidos</th>
            <th className="px-3 py-2">Em atend.</th>
            <th className="px-3 py-2">Propostas</th>
            <th className="px-3 py-2">Fechados</th>
            <th className="px-3 py-2">Perdidos</th>
            <th className="px-3 py-2">Valor fechado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.consultorId ?? r.consultorNome} className="border-t border-zinc-800">
              <td className="px-3 py-2 font-medium text-zinc-200">{r.consultorNome}</td>
              <td className="px-3 py-2">{r.recebidos}</td>
              <td className="px-3 py-2">{r.emAtendimento}</td>
              <td className="px-3 py-2">{r.propostas}</td>
              <td className="px-3 py-2">{r.fechados}</td>
              <td className="px-3 py-2">{r.perdidos}</td>
              <td className="px-3 py-2">{formatCurrency(r.valorFechado)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
