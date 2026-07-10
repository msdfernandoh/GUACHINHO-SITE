"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { LeadListRow } from "@/lib/crm/types";
import type { ConsultorOption } from "@/lib/admin/consultores";
import { labelOrigem, valorEstimadoLead } from "@/lib/crm/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import { LeadStatusBadge } from "./lead-status-badge";
import { LeadTemperatureBadge } from "./lead-temperature-badge";
import { LeadWhatsappButton } from "./lead-whatsapp-button";
import { adminTableCellClass, adminTableHeadClass } from "@/components/admin/admin-contrast";
import { cn } from "@/lib/utils/cn";
import { bulkAssignConsultorAction } from "@/app/admin/leads/actions";
import { Button, Select } from "@/components/ui/form-primitives";

type Props = {
  leads: LeadListRow[];
  consultores: ConsultorOption[];
};

export function LeadListWithBulk({ leads, consultores }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [consultorId, setConsultorId] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const allIds = useMemo(() => leads.map((l) => l.id), [leads]);
  const allSelected = leads.length > 0 && selected.size === leads.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function aplicarConsultor() {
    setMsg(null);
    if (!consultorId) {
      setMsg("Escolha um consultor.");
      return;
    }
    const ids = [...selected];
    startTransition(async () => {
      try {
        await bulkAssignConsultorAction(ids, consultorId);
        setSelected(new Set());
        setMsg(`${ids.length} lead(s) atualizado(s).`);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Erro ao atribuir consultor.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-700 bg-zinc-900/60 p-3">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-semibold text-zinc-300">Consultor para selecionados</label>
          <Select value={consultorId} onChange={(e) => setConsultorId(e.target.value)}>
            <option value="">Selecione…</option>
            {consultores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </div>
        <Button type="button" disabled={pending || selected.size === 0} onClick={aplicarConsultor}>
          {pending ? "Salvando…" : `Atribuir (${selected.size})`}
        </Button>
        {msg ? <p className="text-sm text-amber-300">{msg}</p> : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-700 bg-zinc-950">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className={adminTableHeadClass}>
            <tr>
              <th className="px-3 py-2 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Selecionar todos"
                />
              </th>
              <th className="px-3 py-2">Lead</th>
              <th className="px-3 py-2">Origem</th>
              <th className="px-3 py-2">Produto</th>
              <th className="px-3 py-2">Valor</th>
              <th className="px-3 py-2">Cidade</th>
              <th className="px-3 py-2">Temp.</th>
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
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(l.id)}
                      onChange={() => toggleOne(l.id)}
                      aria-label={`Selecionar ${l.nome}`}
                    />
                  </td>
                  <td className={adminTableCellClass}>
                    <Link href={`/admin/leads/${l.id}`} className="font-semibold text-amber-300 hover:underline">
                      {l.nome}
                    </Link>
                    <p className="text-xs text-zinc-400">{l.whatsapp ?? "—"}</p>
                  </td>
                  <td className={cn(adminTableCellClass, "text-zinc-300")}>{labelOrigem(l.origem)}</td>
                  <td className={cn(adminTableCellClass, "text-white font-medium")}>
                    {l.produto_interesse ?? l.tipo_interesse ?? "—"}
                  </td>
                  <td className={cn(adminTableCellClass, "text-white font-medium tabular-nums")}>
                    {valor > 0 ? formatCurrency(valor) : "—"}
                  </td>
                  <td className={cn(adminTableCellClass, "text-zinc-300")}>{l.cidade ?? "—"}</td>
                  <td className="px-3 py-2">
                    <LeadTemperatureBadge value={l.temperatura} />
                  </td>
                  <td className="px-3 py-2">
                    <LeadStatusBadge status={l.status} />
                  </td>
                  <td className={cn(adminTableCellClass, "text-zinc-300")}>{l.srd_responsavel_nome ?? "—"}</td>
                  <td className="px-3 py-2 max-w-[140px] truncate text-xs text-zinc-300" title={prox}>
                    {prox}
                    {l.data_proxima_acao ? (
                      <p className="text-zinc-500">{formatDateTime(l.data_proxima_acao, null)}</p>
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
    </div>
  );
}
