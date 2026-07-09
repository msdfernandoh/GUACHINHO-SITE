import Link from "next/link";
import { fetchContratacoesList } from "./actions";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import { formatCurrency } from "@/lib/utils/format";
import { statusLabel } from "@/lib/contratacoes-online/status";
import type { ContratacaoStatus } from "@/lib/contratacoes-online/types";
import {
  adminTableCellClass,
  adminTableHeadClass,
} from "@/components/admin/admin-contrast";
import { cn } from "@/lib/utils/cn";

export default async function ContratacoesAdminPage() {
  await requireStaffAdmin();
  const rows = await fetchContratacoesList();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Contratações online</h1>
        <p className="text-sm font-medium text-zinc-400">Fechamento de proposta — simulador e grupos</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-700 bg-zinc-950">
        <table className="min-w-full text-sm">
          <thead className={adminTableHeadClass}>
            <tr>
              <th className="px-3 py-2">Protocolo</th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Telefone</th>
              <th className="px-3 py-2">Origem</th>
              <th className="px-3 py-2">Crédito</th>
              <th className="px-3 py-2">Parcela</th>
              <th className="px-3 py-2">Pagamento</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-zinc-800 hover:bg-zinc-900/80">
                <td className={cn(adminTableCellClass, "font-mono text-xs text-amber-300")}>{r.protocolo}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString("pt-BR")}
                </td>
                <td className="px-3 py-2">{r.nome ?? "—"}</td>
                <td className="px-3 py-2">{r.telefone ?? "—"}</td>
                <td className="px-3 py-2 capitalize">{r.origem}</td>
                <td className="px-3 py-2">
                  {r.credito_selecionado != null ? formatCurrency(r.credito_selecionado) : "—"}
                </td>
                <td className="px-3 py-2">
                  {r.parcela_estimada != null ? formatCurrency(r.parcela_estimada) : "—"}
                </td>
                <td className="px-3 py-2 capitalize">{r.forma_pagamento ?? "—"}</td>
                <td className="px-3 py-2">{statusLabel(r.status as ContratacaoStatus)}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/contratacoes/${r.id}`} className="text-amber-400 hover:underline">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-zinc-500">
                  Nenhuma contratação registrada.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
