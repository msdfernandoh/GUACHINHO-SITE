"use client";

import Link from "next/link";
import type { LeadListRow } from "@/lib/crm/types";
import { labelOrigem, valorEstimadoLead } from "@/lib/crm/constants";
import { labelEventoProduto } from "@/lib/crm/label-evento-produto";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import { LeadStatusBadge } from "./lead-status-badge";
import { LeadTipoSonhoBadge } from "./lead-tipo-sonho-badge";
import { LeadWhatsappButton } from "./lead-whatsapp-button";
import { LeadQuickIndicacaoButton } from "./lead-quick-indicacao";
import {
  adminTableCellClass,
  adminTableHeadClass,
} from "@/components/admin/admin-contrast";
import { cn } from "@/lib/utils/cn";

export function LeadTable({ leads }: { leads: LeadListRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-700 bg-zinc-950">
      <table className="min-w-[1100px] w-full text-sm">
        <thead className={adminTableHeadClass}>
          <tr>
            <th className="px-3 py-2">Lead</th>
            <th className="px-3 py-2">Origem</th>
            <th className="px-3 py-2">Evento / Produto</th>
            <th className="px-3 py-2">Valor</th>
            <th className="px-3 py-2">Cidade</th>
            <th className="px-3 py-2">Tipo do sonho</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Consultor</th>
            <th className="px-3 py-2">Próxima ação</th>
            <th className="px-3 py-2">Última interação</th>
            <th className="px-3 py-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => {
            const valor = valorEstimadoLead(l);
            const prox =
              l.proxima_acao ??
              (l.proximo_retorno_data ? `Retorno ${formatDate(l.proximo_retorno_data)}` : "—");
            return (
              <tr key={l.id} className="border-b border-zinc-800 hover:bg-zinc-900/70">
                <td className={adminTableCellClass}>
                  <div className="flex items-start gap-2">
                    <LeadQuickIndicacaoButton leadId={l.id} leadNome={l.nome} className="mt-0.5" />
                    <div className="min-w-0">
                      <Link href={`/admin/leads/${l.id}`} className="font-semibold text-amber-300 hover:underline">
                        {l.nome}
                      </Link>
                      <p className="text-xs text-zinc-400">{l.whatsapp ?? "—"}</p>
                    </div>
                  </div>
                </td>
                <td className={cn(adminTableCellClass, "text-zinc-300")}>
                  <div>{labelOrigem(l.origem)}</div>
                  {l.origem === "indicacao" && l.parceiro_indicador_nome ? (
                    <p className="mt-0.5 text-[11px] text-amber-200/80" title="Quem indicou">
                      {l.parceiro_indicador_nome}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2">{labelEventoProduto(l)}</td>
                <td className="px-3 py-2">{valor > 0 ? formatCurrency(valor) : "—"}</td>
                <td className="px-3 py-2">{l.cidade ?? "—"}</td>
                <td className="px-3 py-2">
                  <LeadTipoSonhoBadge value={l.tipo_sonho} />
                </td>
                <td className="px-3 py-2">
                  <LeadStatusBadge status={l.status} />
                </td>
                <td className="px-3 py-2">{l.srd_responsavel_nome ?? "—"}</td>
                <td className="px-3 py-2 max-w-[140px] truncate text-xs" title={prox}>
                  {prox}
                  {l.data_proxima_acao ? (
                    <p className="text-zinc-600">{formatDateTime(l.data_proxima_acao, null)}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs text-zinc-500">
                  {l.ultima_interacao_at ? formatDate(l.ultima_interacao_at) : formatDate(l.created_at)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/admin/leads/${l.id}`} className="text-xs text-amber-400 hover:underline">
                      Detalhe
                    </Link>
                    <Link href={`/admin/agenda?lead=${l.id}`} className="text-xs text-zinc-400 hover:underline">
                      Agendar
                    </Link>
                    <LeadWhatsappButton
                      nome={l.nome}
                      whatsapp={l.whatsapp}
                      produto={l.produto_interesse ?? l.tipo_interesse}
                      leadId={l.id}
                      compact
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!leads.length ? <p className="p-6 text-center text-zinc-500">Nenhum lead encontrado</p> : null}
    </div>
  );
}
