import type { OrigemReportRow } from "@/lib/crm/reports";
import { formatCurrency } from "@/lib/utils/format";
import {
  adminTableCellClass,
  adminTableCellMutedClass,
  adminTableHeadClass,
  adminTableRowClass,
  adminTableWrapClass,
} from "@/components/admin/admin-contrast";

export function LeadOriginReport({ rows }: { rows: OrigemReportRow[] }) {
  return (
    <div className={adminTableWrapClass}>
      <table className="min-w-full text-sm">
        <thead className={adminTableHeadClass}>
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
            <tr key={r.origem} className={adminTableRowClass}>
              <td className={`${adminTableCellClass} font-medium text-zinc-50`}>{r.label}</td>
              <td className={adminTableCellMutedClass}>{r.leads}</td>
              <td className={adminTableCellMutedClass}>{r.qualificados}</td>
              <td className={adminTableCellMutedClass}>{r.propostas}</td>
              <td className={adminTableCellMutedClass}>{r.fechados}</td>
              <td className={adminTableCellMutedClass}>{r.perdidos}</td>
              <td className={adminTableCellMutedClass}>{formatCurrency(r.valorPotencial)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
