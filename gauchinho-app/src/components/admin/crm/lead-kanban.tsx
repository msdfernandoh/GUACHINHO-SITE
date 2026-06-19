"use client";

import { useTransition } from "react";
import { updateLeadStatusAction } from "@/app/admin/leads/actions";
import type { LeadListRow } from "@/lib/crm/types";
import { KANBAN_STATUSES } from "@/lib/crm/constants";
import { labelOrigem, valorEstimadoLead } from "@/lib/crm/constants";
import { formatCurrency } from "@/lib/utils/format";
import Link from "next/link";
import { LeadTemperatureBadge } from "./lead-temperature-badge";
import { FUNNEL_STATUSES } from "@/lib/crm/constants";

export function LeadKanban({ leads }: { leads: LeadListRow[] }) {
  const [, startTransition] = useTransition();

  const byStatus = new Map<string, LeadListRow[]>();
  for (const st of KANBAN_STATUSES) byStatus.set(st, []);
  for (const l of leads) {
    const st = (KANBAN_STATUSES as readonly string[]).includes(l.status) ? l.status : "Novo";
    byStatus.get(st)?.push(l);
  }

  function move(leadId: string, status: string) {
    startTransition(async () => {
      await updateLeadStatusAction(leadId, status);
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {KANBAN_STATUSES.map((col) => (
        <div
          key={col}
          className="min-w-[240px] flex-1 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"
        >
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-amber-500/90">
            {col}{" "}
            <span className="text-zinc-500">({byStatus.get(col)?.length ?? 0})</span>
          </h3>
          <div className="space-y-2">
            {(byStatus.get(col) ?? []).map((l) => (
              <article
                key={l.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-sm shadow-sm"
              >
                <Link href={`/admin/leads/${l.id}`} className="font-semibold text-zinc-100 hover:text-amber-400">
                  {l.nome}
                </Link>
                <p className="mt-1 text-[11px] text-zinc-500">{labelOrigem(l.origem)}</p>
                <p className="text-xs text-zinc-400">{l.produto_interesse ?? l.tipo_interesse ?? "—"}</p>
                {valorEstimadoLead(l) > 0 ? (
                  <p className="mt-1 text-xs font-medium text-amber-400">{formatCurrency(valorEstimadoLead(l))}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1">
                  <LeadTemperatureBadge value={l.temperatura} />
                </div>
                {l.proxima_acao ? (
                  <p className="mt-2 text-[10px] text-zinc-500">Próx: {l.proxima_acao}</p>
                ) : null}
                <p className="mt-1 text-[10px] text-zinc-600">{l.srd_responsavel_nome ?? "Sem consultor"}</p>
                <select
                  className="mt-2 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300"
                  defaultValue={l.status}
                  onChange={(e) => move(l.id, e.target.value)}
                >
                  {FUNNEL_STATUSES.filter((s) => s !== "Arquivado").map((s) => (
                    <option key={s} value={s}>
                      → {s}
                    </option>
                  ))}
                </select>
              </article>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
