"use client";

import { useState, useTransition } from "react";
import { Plus, UserPlus, X } from "lucide-react";
import {
  createIndicacoesFromLeadAction,
} from "@/app/admin/leads/actions";
import type { IndicacaoRapidaItem } from "@/lib/crm/types";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";
import { TIPOS_SONHO_SORTEIO } from "@/lib/eventos-sorteio/types";
import { digitsOnlyPhone, formatWhatsappBrInput } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const PARENTESCOS = ["Amigo", "Familiar", "Cônjuge", "Colega", "Cliente", "Outro"] as const;

type Row = IndicacaoRapidaItem & { id: string };

function emptyRow(): Row {
  return {
    id: crypto.randomUUID(),
    nome: "",
    whatsapp: "",
    tipoSonho: "",
    parentesco: "",
  };
}

type Props = {
  leadId: string;
  leadNome: string;
  className?: string;
};

export function LeadQuickIndicacaoButton({ leadId, leadNome, className }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => [emptyRow()]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openModal() {
    setRows([emptyRow()]);
    setMsg(null);
    setErr(null);
    setOpen(true);
  }

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function submit() {
    setMsg(null);
    setErr(null);
    const payload = rows
      .map(({ nome, whatsapp, tipoSonho, parentesco }) => ({
        nome: nome.trim(),
        whatsapp: whatsapp.trim(),
        tipoSonho: tipoSonho?.trim() || null,
        parentesco: parentesco?.trim() || null,
      }))
      .filter((r) => r.nome && digitsOnlyPhone(r.whatsapp).length >= 10);

    if (payload.length === 0) {
      setErr("Preencha nome e telefone (com DDD) de ao menos um indicado.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createIndicacoesFromLeadAction(leadId, payload);
        setMsg(`${result.count} indicação(ões) criada(s).`);
        setRows([emptyRow()]);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Erro ao salvar indicações.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title={`Indicações de ${leadNome}`}
        aria-label={`Incluir indicações de ${leadNome}`}
        className={cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20",
          className,
        )}
      >
        <UserPlus className="h-3.5 w-3.5" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`indicacao-titulo-${leadId}`}
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-4 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id={`indicacao-titulo-${leadId}`} className="text-lg font-semibold text-zinc-100">
                  Incluir indicações
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Quem indicou: <span className="font-medium text-amber-300">{leadNome}</span>
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {rows.map((row, index) => (
                <div
                  key={row.id}
                  className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-200">Indicado {index + 1}</p>
                    {rows.length > 1 ? (
                      <button
                        type="button"
                        className="text-xs text-zinc-500 hover:text-red-400"
                        onClick={() => setRows((list) => list.filter((r) => r.id !== row.id))}
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label>Nome *</Label>
                      <Input
                        value={row.nome}
                        onChange={(e) => updateRow(row.id, { nome: e.target.value })}
                        placeholder="Nome completo"
                        autoComplete="off"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Telefone / WhatsApp *</Label>
                      <Input
                        inputMode="tel"
                        value={row.whatsapp}
                        onChange={(e) =>
                          updateRow(row.id, { whatsapp: formatWhatsappBrInput(e.target.value) })
                        }
                        placeholder="(66) 99999-9999"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <Label>Tipo (opcional)</Label>
                      <Select
                        value={row.tipoSonho ?? ""}
                        onChange={(e) => updateRow(row.id, { tipoSonho: e.target.value })}
                      >
                        <option value="">—</option>
                        {TIPOS_SONHO_SORTEIO.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label>Parentesco (opcional)</Label>
                      <Select
                        value={row.parentesco ?? ""}
                        onChange={(e) => updateRow(row.id, { parentesco: e.target.value })}
                      >
                        <option value="">—</option>
                        {PARENTESCOS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setRows((list) => [...list, emptyRow()])}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-amber-500/40 py-2 text-sm text-amber-300 hover:bg-amber-500/10"
            >
              <Plus className="h-4 w-4" /> Adicionar outra pessoa
            </button>

            {err ? <p className="mt-3 text-sm text-red-400">{err}</p> : null}
            {msg ? <p className="mt-3 text-sm text-emerald-400">{msg}</p> : null}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
                {msg ? "Fechar" : "Cancelar"}
              </Button>
              <Button type="button" disabled={pending} onClick={submit}>
                {pending ? "Salvando…" : "Salvar indicações"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
