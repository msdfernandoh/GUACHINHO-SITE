"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import {
  addConvidadoToListaAction,
  deleteConvidadoItemAction,
  updateConvidadoItemAction,
  updateListaMetaAction,
} from "@/app/admin/eventos/listas-convidados/actions";
import type {
  EventoListaConvidadosItemRow,
  EventoListaConvidadosRow,
  ListaConvidadoResultado,
  ListaConvidadoStatus,
} from "@/lib/comercial-eventos/listas-convidados-types";
import {
  LISTA_CONVIDADO_RESULTADO,
  LISTA_CONVIDADO_STATUS,
  LISTA_RESULTADO_LABEL,
  LISTA_STATUS_LABEL,
} from "@/lib/comercial-eventos/listas-convidados-types";
import { countListaConvidadosItens } from "@/lib/comercial-eventos/listas-convidados-stats";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";
import { formatCurrency, formatWhatsappBrInput } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type Props = {
  lista: EventoListaConvidadosRow & { evento_nome: string };
  itens: EventoListaConvidadosItemRow[];
  eventos: { id: string; nome: string }[];
};

function TagGroup<T extends string>({
  value,
  options,
  labels,
  onPick,
  tone,
}: {
  value: T | null;
  options: readonly T[];
  labels: Record<T, string>;
  onPick: (v: T | null) => void;
  tone: "status" | "resultado";
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {tone === "resultado" ? (
        <button
          type="button"
          onClick={() => onPick(null)}
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            value === null
              ? "bg-zinc-600 text-white"
              : "border border-zinc-500 text-zinc-400 hover:border-zinc-400",
          )}
        >
          —
        </button>
      ) : null}
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onPick(opt)}
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition",
            value === opt
              ? tone === "status"
                ? opt === "confirmado"
                  ? "bg-emerald-600 text-white"
                  : opt === "presente"
                    ? "bg-sky-600 text-white"
                    : opt === "cancelado"
                      ? "bg-red-600 text-white"
                      : "bg-amber-600 text-white"
                : opt === "ganho"
                  ? "bg-emerald-700 text-white"
                  : opt === "futuro"
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-600 text-white"
              : "border border-zinc-500 text-zinc-400 hover:border-amber-500/50 hover:text-amber-200",
          )}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

export function ListaConvidadosDetailClient({ lista, itens, eventos }: Props) {
  const [rows, setRows] = useState(itens);
  const [editMeta, setEditMeta] = useState(false);
  const [eventoId, setEventoId] = useState(lista.evento_id);
  const [consultorNome, setConsultorNome] = useState(lista.consultor_nome);
  const [quickNome, setQuickNome] = useState("");
  const [quickEmpresa, setQuickEmpresa] = useState("");
  const [quickTel, setQuickTel] = useState("");
  const [quickConvidou, setQuickConvidou] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => countListaConvidadosItens(rows), [rows]);

  const patchItem = (itemId: string, patch: Parameters<typeof updateConvidadoItemAction>[2]) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === itemId
          ? {
              ...r,
              ...patch,
              valor: patch.valor !== undefined ? patch.valor : r.valor,
              resultado: patch.resultado !== undefined ? patch.resultado : r.resultado,
            }
          : r,
      ),
    );
    startTransition(async () => {
      try {
        await updateConvidadoItemAction(itemId, lista.id, patch);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao atualizar");
      }
    });
  };

  const saveMeta = () => {
    setErro(null);
    startTransition(async () => {
      try {
        await updateListaMetaAction(lista.id, { evento_id: eventoId, consultor_nome: consultorNome });
        setEditMeta(false);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao salvar");
      }
    });
  };

  const addQuick = () => {
    if (!quickNome.trim()) return;
    setErro(null);
    startTransition(async () => {
      try {
        await addConvidadoToListaAction(lista.id, {
          nome: quickNome,
          empresa: quickEmpresa,
          telefone: quickTel,
          convidado_por: quickConvidou,
        });
        setQuickNome("");
        setQuickEmpresa("");
        setQuickTel("");
        setQuickConvidou("");
        window.location.reload();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao adicionar");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/eventos/listas-convidados" className="text-sm text-amber-600 hover:underline">
            ← Listas de convidados
          </Link>
          {!editMeta ? (
            <>
              <h1 className="mt-2 text-2xl font-bold">{lista.evento_nome}</h1>
              <p className="text-sm text-zinc-500">
                Consultor: <span className="font-medium text-zinc-700 dark:text-zinc-200">{lista.consultor_nome}</span>
              </p>
            </>
          ) : (
            <div className="mt-3 grid max-w-xl gap-3 sm:grid-cols-2">
              <div>
                <Label>Evento</Label>
                <Select value={eventoId} onChange={(e) => setEventoId(e.target.value)} className="mt-1">
                  {eventos.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.nome}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Consultor</Label>
                <Input value={consultorNome} onChange={(e) => setConsultorNome(e.target.value)} className="mt-1" />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="button" size="sm" onClick={saveMeta} disabled={pending}>
                  Salvar
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditMeta(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
        {!editMeta ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditMeta(true)}>
            Editar lista
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Na lista", value: counts.total },
          { label: "Confirmados", value: counts.confirmados },
          { label: "Presentes", value: counts.presentes },
          { label: "Cancelados", value: counts.cancelados },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border px-4 py-3 dark:border-zinc-800">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{c.label}</p>
            <p className="text-2xl font-bold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border dark:border-zinc-800">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left text-xs uppercase dark:bg-zinc-900">
            <tr>
              <th className="px-2 py-2">Nome</th>
              <th className="px-2 py-2">Empresa</th>
              <th className="px-2 py-2">Telefone</th>
              <th className="px-2 py-2">Convidado por</th>
              <th className="px-2 py-2">Presença</th>
              <th className="px-2 py-2">Resultado</th>
              <th className="px-2 py-2">Valor</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b align-top dark:border-zinc-800">
                <td className="px-2 py-2 font-medium">{row.nome}</td>
                <td className="px-2 py-2 text-zinc-500">{row.empresa ?? "—"}</td>
                <td className="px-2 py-2">{row.telefone ?? "—"}</td>
                <td className="px-2 py-2 text-zinc-500">{row.convidado_por ?? "—"}</td>
                <td className="px-2 py-2">
                  <TagGroup
                    value={row.status_presenca}
                    options={LISTA_CONVIDADO_STATUS}
                    labels={LISTA_STATUS_LABEL}
                    tone="status"
                    onPick={(v) => {
                      if (!v) return;
                      patchItem(row.id, { status_presenca: v as ListaConvidadoStatus });
                    }}
                  />
                </td>
                <td className="px-2 py-2">
                  <TagGroup
                    value={row.resultado}
                    options={LISTA_CONVIDADO_RESULTADO}
                    labels={LISTA_RESULTADO_LABEL}
                    tone="resultado"
                    onPick={(v) => patchItem(row.id, { resultado: v })}
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    className="h-8 w-28"
                    defaultValue={row.valor ?? ""}
                    onBlur={(e) => {
                      const raw = e.target.value.trim();
                      const val = raw === "" ? null : Number.parseFloat(raw.replace(",", "."));
                      if (raw !== "" && !Number.isFinite(val)) return;
                      patchItem(row.id, { valor: val });
                    }}
                  />
                  {row.valor != null && Number.isFinite(row.valor) ? (
                    <p className="mt-0.5 text-[10px] text-zinc-500">{formatCurrency(row.valor)}</p>
                  ) : null}
                </td>
                <td className="px-2 py-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm("Remover este convidado da lista?")) return;
                      startTransition(async () => {
                        await deleteConvidadoItemAction(row.id, lista.id);
                        setRows((prev) => prev.filter((r) => r.id !== row.id));
                      });
                    }}
                  >
                    Excluir
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border p-4 dark:border-zinc-800">
        <p className="text-sm font-semibold">Adicionar convidado rápido</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-12 sm:items-end">
          <div className="sm:col-span-3">
            <Label className="text-xs">Nome *</Label>
            <Input value={quickNome} onChange={(e) => setQuickNome(e.target.value)} className="mt-1 h-9" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Empresa</Label>
            <Input value={quickEmpresa} onChange={(e) => setQuickEmpresa(e.target.value)} className="mt-1 h-9" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Telefone</Label>
            <Input
              value={quickTel}
              onChange={(e) => setQuickTel(formatWhatsappBrInput(e.target.value))}
              className="mt-1 h-9"
            />
          </div>
          <div className="sm:col-span-3">
            <Label className="text-xs">Convidado por</Label>
            <Input value={quickConvidou} onChange={(e) => setQuickConvidou(e.target.value)} className="mt-1 h-9" />
          </div>
          <div className="sm:col-span-2">
            <Button type="button" className="h-9 w-full" onClick={addQuick} disabled={pending || !quickNome.trim()}>
              <Plus className="mr-1 h-4 w-4" />
              Incluir
            </Button>
          </div>
        </div>
      </div>

      {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
    </div>
  );
}
