import type { ConsultorReportRow } from "@/lib/crm/reports";
import { formatCurrency } from "@/lib/utils/format";
import {
  adminTableCellClass,
  adminTableCellMutedClass,
  adminTableHeadClass,
  adminTableRowClass,
  adminTableWrapClass,
} from "@/components/admin/admin-contrast";

export function LeadConsultorReport({ rows }: { rows: ConsultorReportRow[] }) {
  return (
    <div className={adminTableWrapClass}>
      <table className="min-w-full text-sm">
        <thead className={adminTableHeadClass}>
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
            <tr key={r.consultorId ?? r.consultorNome} className={adminTableRowClass}>
              <td className={`${adminTableCellClass} font-medium text-zinc-50`}>{r.consultorNome}</td>
              <td className={adminTableCellMutedClass}>{r.recebidos}</td>
              <td className={adminTableCellMutedClass}>{r.emAtendimento}</td>
              <td className={adminTableCellMutedClass}>{r.propostas}</td>
              <td className={adminTableCellMutedClass}>{r.fechados}</td>
              <td className={adminTableCellMutedClass}>{r.perdidos}</td>
              <td className={adminTableCellMutedClass}>{formatCurrency(r.valorFechado)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
