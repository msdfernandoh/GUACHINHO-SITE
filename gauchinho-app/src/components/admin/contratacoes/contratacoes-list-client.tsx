"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteContratacaoAction,
  deleteContratacoesSemClienteAction,
} from "@/app/admin/contratacoes/actions";
import { formatCurrency } from "@/lib/utils/format";
import { statusLabel } from "@/lib/contratacoes-online/status";
import type { ContratacaoOnlineRow, ContratacaoStatus } from "@/lib/contratacoes-online/types";
import {
  adminTableCellClass,
  adminTableHeadClass,
} from "@/components/admin/admin-contrast";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/form-primitives";

export function ContratacoesListClient({ rows }: { rows: ContratacaoOnlineRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const semCliente = rows.filter((r) => !r.nome?.trim()).length;

  const excluir = (id: string, protocolo: string) => {
    if (!confirm(`Excluir a contratação ${protocolo}? Esta ação não pode ser desfeita.`)) return;
    setErro(null);
    setMsg(null);
    startTransition(async () => {
      const res = await deleteContratacaoAction(id);
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setMsg(`Contratação ${protocolo} excluída.`);
      router.refresh();
    });
  };

  const limparSemCliente = () => {
    if (
      !confirm(
        `Excluir ${semCliente} contratação(ões) sem nome do cliente?\n\nIsso remove propostas incompletas gravadas sem identificação.`,
      )
    ) {
      return;
    }
    setErro(null);
    setMsg(null);
    startTransition(async () => {
      const res = await deleteContratacoesSemClienteAction();
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setMsg(`${res.removed} contratação(ões) sem cliente excluída(s).`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          {rows.length} registro(s)
          {semCliente > 0 ? (
            <span className="ml-2 text-amber-400">· {semCliente} sem nome do cliente</span>
          ) : null}
        </p>
        {semCliente > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={limparSemCliente}
            className="border-red-500/40 text-red-300 hover:bg-red-500/10"
          >
            {pending ? "Excluindo…" : `Excluir ${semCliente} sem cliente`}
          </Button>
        ) : null}
      </div>

      {erro ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {erro}
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {msg}
        </p>
      ) : null}

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
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const incompleta = !r.nome?.trim();
              return (
                <tr
                  key={r.id}
                  className={cn(
                    "border-t border-zinc-800 hover:bg-zinc-900/80",
                    incompleta && "bg-red-950/20",
                  )}
                >
                  <td className={cn(adminTableCellClass, "font-mono text-xs text-amber-300")}>
                    {r.protocolo}
                  </td>
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
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/contratacoes/${r.id}`}
                        className="text-amber-400 hover:underline"
                      >
                        Ver
                      </Link>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => excluir(r.id, r.protocolo)}
                        className="text-red-400 hover:underline disabled:opacity-50"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
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
