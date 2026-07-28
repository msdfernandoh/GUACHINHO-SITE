"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { LeadListRow } from "@/lib/crm/types";
import type { ConsultorOption } from "@/lib/admin/consultores";
import { labelOrigem, valorEstimadoLead } from "@/lib/crm/constants";
import { labelEventoProduto } from "@/lib/crm/label-evento-produto";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import { LeadStatusBadge } from "./lead-status-badge";
import { LeadTipoSonhoBadge } from "./lead-tipo-sonho-badge";
import { LeadWhatsappButton } from "./lead-whatsapp-button";
import { LeadQuickIndicacaoButton } from "./lead-quick-indicacao";
import { adminTableCellClass, adminTableHeadClass } from "@/components/admin/admin-contrast";
import { cn } from "@/lib/utils/cn";
import { bulkAssignConsultorAction, bulkDeleteLeadsAction } from "@/app/admin/leads/actions";
import { Button, Input, Select } from "@/components/ui/form-primitives";

type Props = {
  leads: LeadListRow[];
  consultores: ConsultorOption[];
  canDelete?: boolean;
};

export function LeadListWithBulk({ leads, consultores, canDelete = false }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [consultorId, setConsultorId] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

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

  function abrirExclusao() {
    setMsg(null);
    if (selected.size === 0) {
      setMsg("Selecione ao menos um lead.");
      return;
    }
    setConfirmText("");
    setDeleteOpen(true);
  }

  function confirmarExclusao() {
    setMsg(null);
    const ids = [...selected];
    startTransition(async () => {
      try {
        const result = await bulkDeleteLeadsAction(ids, confirmText);
        setSelected(new Set());
        setDeleteOpen(false);
        setConfirmText("");
        setMsg(`${result.deleted} lead(s) excluído(s).`);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Erro ao excluir leads.");
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
        {canDelete ? (
          <Button
            type="button"
            variant="outline"
            className="border-red-500/50 text-red-300 hover:bg-red-500/10"
            disabled={pending || selected.size === 0}
            onClick={abrirExclusao}
          >
            Excluir selecionados ({selected.size})
          </Button>
        ) : null}
        {msg ? <p className="text-sm text-amber-300">{msg}</p> : null}
      </div>

      {deleteOpen ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 space-y-3">
          <p className="text-sm font-semibold text-red-200">
            Excluir {selected.size} lead(s) permanentemente?
          </p>
          <p className="text-xs text-red-100/80">
            Digite <strong className="font-bold text-white">EXCLUIR</strong> para confirmar. Esta ação não
            pode ser desfeita.
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Digite EXCLUIR"
            className="max-w-xs"
            autoComplete="off"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-red-500/60 bg-red-600/80 text-white hover:bg-red-600"
              disabled={pending || confirmText.trim().toUpperCase() !== "EXCLUIR"}
              onClick={confirmarExclusao}
            >
              {pending ? "Excluindo…" : "Confirmar exclusão"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setDeleteOpen(false);
                setConfirmText("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

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
              const eventoProduto = labelEventoProduto(l);
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
                  <td className={cn(adminTableCellClass, "text-white font-medium")} title={eventoProduto}>
                    {eventoProduto}
                  </td>
                  <td className={cn(adminTableCellClass, "text-white font-medium tabular-nums")}>
                    {valor > 0 ? formatCurrency(valor) : "—"}
                  </td>
                  <td className={cn(adminTableCellClass, "text-zinc-300")}>{l.cidade ?? "—"}</td>
                  <td className="px-3 py-2">
                    <LeadTipoSonhoBadge value={l.tipo_sonho} />
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
                        produto={l.produto_interesse ?? l.tipo_interesse ?? l.evento_nome}
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
