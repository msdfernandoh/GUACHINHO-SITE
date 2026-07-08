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
import { countListaConvidadosItens, resolveConvidadoPor } from "@/lib/comercial-eventos/listas-convidados-stats";
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
  const [eventoId, setEventoId] = useState(lista.evento_id);
  const [eventoLabel, setEventoLabel] = useState(lista.evento_nome);
  const [consultorNome, setConsultorNome] = useState(lista.consultor_nome);
  const [savedConsultor, setSavedConsultor] = useState(lista.consultor_nome);
  const [savedEventoId, setSavedEventoId] = useState(lista.evento_id);
  const [metaSaved, setMetaSaved] = useState(true);
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
        setErro(null);
        await updateConvidadoItemAction(itemId, lista.id, patch);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao atualizar");
      }
    });
  };

  const saveListaMeta = (next: { evento_id: string; consultor_nome: string }) => {
    setMetaSaved(false);
    startTransition(async () => {
      try {
        setErro(null);
        await updateListaMetaAction(lista.id, next);
        setSavedConsultor(next.consultor_nome);
        setSavedEventoId(next.evento_id);
        setMetaSaved(true);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao salvar lista");
        setMetaSaved(false);
      }
    });
  };

  const onEventoChange = (nextId: string) => {
    setEventoId(nextId);
    const ev = eventos.find((e) => e.id === nextId);
    setEventoLabel(ev?.nome ?? eventoLabel);
    saveListaMeta({ evento_id: nextId, consultor_nome: consultorNome.trim() || savedConsultor });
  };

  const onConsultorBlur = () => {
    const trimmed = consultorNome.trim();
    if (!trimmed || trimmed === savedConsultor) return;
    saveListaMeta({ evento_id: eventoId, consultor_nome: trimmed });
  };

  const commitTextField = (
    row: EventoListaConvidadosItemRow,
    field: "nome" | "empresa" | "telefone" | "convidado_por",
    raw: string,
  ) => {
    let value = raw.trim();
    if (field === "telefone") {
      value = formatWhatsappBrInput(value);
    }
    if (field === "nome" && !value) {
      setErro("Nome do convidado não pode ficar vazio.");
      return;
    }
    if (field === "convidado_por") {
      value = resolveConvidadoPor(value, consultorNome);
    }
    const prev =
      field === "nome"
        ? row.nome
        : field === "empresa"
          ? row.empresa ?? ""
          : field === "telefone"
            ? row.telefone ?? ""
            : resolveConvidadoPor(row.convidado_por, consultorNome);
    if (value === prev) return;

    const patch =
      field === "nome"
        ? { nome: value }
        : field === "empresa"
          ? { empresa: value || null }
          : field === "telefone"
            ? { telefone: value || null }
            : { convidado_por: value };

    patchItem(row.id, patch);
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
      <div>
        <Link href="/admin/eventos/listas-convidados" className="text-sm text-amber-600 hover:underline">
          ← Listas de convidados
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Editar lista</h1>
        <p className="text-sm text-zinc-500">
          Altere evento, consultor e convidados direto na tabela (salva ao sair do campo).
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 sm:grid-cols-12 sm:items-end">
        <div className="sm:col-span-5">
          <Label>Evento</Label>
          <Select value={eventoId} onChange={(e) => onEventoChange(e.target.value)} className="mt-1">
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.nome}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-zinc-500">Trocar evento move a lista inteira para outro encontro.</p>
        </div>
        <div className="sm:col-span-4">
          <Label>Consultor</Label>
          <Input
            value={consultorNome}
            onChange={(e) => {
              setConsultorNome(e.target.value);
              setMetaSaved(false);
            }}
            onBlur={onConsultorBlur}
            className="mt-1"
          />
        </div>
        <div className="sm:col-span-3">
          <p className="text-xs text-zinc-500">Lista vinculada a</p>
          <p className="mt-1 text-sm font-medium leading-snug">{eventoLabel}</p>
          <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
            {metaSaved ? "Dados da lista salvos" : pending ? "Salvando…" : "Alteração pendente…"}
          </p>
        </div>
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
        <table className="min-w-[1200px] w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left text-xs uppercase dark:bg-zinc-900">
            <tr>
              <th className="min-w-[160px] px-2 py-2">Nome</th>
              <th className="min-w-[120px] px-2 py-2">Empresa</th>
              <th className="min-w-[130px] px-2 py-2">Telefone</th>
              <th className="min-w-[120px] px-2 py-2">Convidado por</th>
              <th className="px-2 py-2">Presença</th>
              <th className="px-2 py-2">Resultado</th>
              <th className="px-2 py-2">Valor</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b align-top dark:border-zinc-800">
                <td className="px-2 py-2">
                  <Input
                    key={`${row.id}-nome-${row.updated_at}`}
                    defaultValue={row.nome}
                    className="h-8 min-w-[140px] text-sm font-medium"
                    onBlur={(e) => commitTextField(row, "nome", e.target.value)}
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    key={`${row.id}-empresa-${row.updated_at}`}
                    defaultValue={row.empresa ?? ""}
                    className="h-8 min-w-[100px] text-sm"
                    placeholder="—"
                    onBlur={(e) => commitTextField(row, "empresa", e.target.value)}
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    key={`${row.id}-tel-${row.updated_at}`}
                    defaultValue={row.telefone ?? ""}
                    className="h-8 min-w-[120px] text-sm"
                    inputMode="tel"
                    placeholder="(51) 99999-9999"
                    onBlur={(e) => commitTextField(row, "telefone", e.target.value)}
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    key={`${row.id}-conv-${row.updated_at}`}
                    defaultValue={resolveConvidadoPor(row.convidado_por, consultorNome)}
                    className="h-8 min-w-[100px] text-sm"
                    placeholder={consultorNome}
                    onBlur={(e) => commitTextField(row, "convidado_por", e.target.value)}
                  />
                </td>
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
