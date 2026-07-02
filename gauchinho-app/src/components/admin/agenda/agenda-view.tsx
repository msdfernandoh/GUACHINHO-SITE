"use client";

import { useMemo, useState } from "react";
import type { AgendaCompromissoRow } from "@/lib/agenda/types";
import { AGENDA_TIPOS, AGENDA_RESULTADOS } from "@/lib/agenda/types";
import { cancelCompromissoAction, concluirCompromissoAction, createCompromissoAction } from "@/app/admin/agenda/actions";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form-primitives";
import { formatDateTime } from "@/lib/utils/format";

type Srd = { id: string; nome: string };

type Props = {
  month: number;
  year: number;
  compromissos: AgendaCompromissoRow[];
  srds: Srd[];
  initialDay?: string;
  initialLeadId?: string;
};

function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function AgendaView({ month, year, compromissos, srds, initialDay, initialLeadId }: Props) {
  const [selected, setSelected] = useState(initialDay ?? `${year}-${pad(month)}-01`);
  const [showNew, setShowNew] = useState(!!initialLeadId);
  const [concluirId, setConcluirId] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaCompromissoRow[]>();
    for (const c of compromissos) {
      const d = c.data_inicio.slice(0, 10);
      const list = map.get(d) ?? [];
      list.push(c);
      map.set(d, list);
    }
    return map;
  }, [compromissos]);

  const totalDays = daysInMonth(year, month);
  const firstDow = new Date(year, month - 1, 1).getDay();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];

  const dayItems = byDay.get(selected) ?? [];
  const hoje = new Date().toISOString().slice(0, 10);
  const atrasados = compromissos.filter((c) => c.status === "agendado" && c.data_inicio.slice(0, 10) < hoje);
  const hojeItems = byDay.get(hoje) ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs uppercase text-zinc-500">Hoje</p>
          <p className="text-2xl font-bold text-white">{hojeItems.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs uppercase text-zinc-500">Atrasados</p>
          <p className="text-2xl font-bold text-amber-400">{atrasados.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs uppercase text-zinc-500">Mês</p>
          <p className="text-2xl font-bold text-white">{compromissos.length}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="rounded-xl border border-zinc-800 p-4">
          <p className="mb-3 text-sm font-semibold text-zinc-300">
            {pad(month)}/{year}
          </p>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-zinc-500">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day == null) return <span key={`e-${i}`} />;
              const key = `${year}-${pad(month)}-${pad(day)}`;
              const count = byDay.get(key)?.length ?? 0;
              const active = key === selected;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelected(key);
                    setShowNew(false);
                  }}
                  className={`relative rounded-lg py-2 text-sm ${
                    active ? "bg-amber-500 text-zinc-950 font-bold" : "hover:bg-zinc-800 text-zinc-200"
                  }`}
                >
                  {day}
                  {count > 0 ? (
                    <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-400" />
                  ) : null}
                </button>
              );
            })}
          </div>
          <Button type="button" className="mt-4 w-full" variant="outline" onClick={() => setShowNew(true)}>
            Novo compromisso — {selected}
          </Button>
        </div>

        <div className="space-y-4">
          {showNew ? (
            <form action={createCompromissoAction} className="space-y-3 rounded-xl border border-zinc-800 p-4">
              <h3 className="font-semibold text-white">Novo compromisso</h3>
              <input type="hidden" name="data" value={selected} />
              <div>
                <Label>Título</Label>
                <Input name="titulo" required defaultValue="Atendimento" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Hora</Label>
                  <Input name="hora" type="time" defaultValue="10:00" required />
                </div>
                <div>
                  <Label>Duração (min)</Label>
                  <Input name="duracao_minutos" type="number" defaultValue="60" />
                </div>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select name="tipo" defaultValue="Atendimento">
                  {AGENDA_TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Consultor</Label>
                <Select name="consultor_id" defaultValue={srds[0]?.id ?? ""}>
                  {srds.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Lead (UUID — opcional)</Label>
                <Input name="lead_id" defaultValue={initialLeadId ?? ""} placeholder="cole o id do lead" />
              </div>
              <div>
                <Label>Local</Label>
                <Input name="local" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea name="descricao" rows={2} />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Salvar</Button>
                <Button type="button" variant="outline" onClick={() => setShowNew(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          ) : null}

          <div className="rounded-xl border border-zinc-800 p-4">
            <h3 className="font-semibold text-white">Compromissos — {selected}</h3>
            {dayItems.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">Nenhum compromisso neste dia.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {dayItems.map((c) => (
                  <li key={c.id} className="rounded-lg border border-zinc-800/80 p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-white">{c.titulo}</p>
                        <p className="text-xs text-zinc-500">
                          {formatDateTime(c.data_inicio, null)} · {c.tipo} · {c.status}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {c.leads?.nome ?? "Sem lead"} · {c.usuarios?.nome ?? "Consultor"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {c.status === "agendado" ? (
                          <Button type="button" size="sm" variant="gold" onClick={() => setConcluirId(c.id)}>
                            Concluir
                          </Button>
                        ) : null}
                        {c.status === "agendado" ? (
                          <form action={cancelCompromissoAction.bind(null, c.id)}>
                            <Button type="submit" size="sm" variant="outline">
                              Cancelar
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                    {concluirId === c.id ? (
                      <form action={concluirCompromissoAction.bind(null, c.id)} className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
                        <Label>Resultado</Label>
                        <Select name="resultado" required>
                          {AGENDA_RESULTADOS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </Select>
                        <Label>Nova data (se retorno)</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input name="proxima_data" type="date" />
                          <Input name="proxima_hora" type="time" defaultValue="10:00" />
                        </div>
                        <Textarea name="observacao_resultado" rows={2} placeholder="Observação" />
                        <Button type="submit" size="sm">
                          Registrar conclusão
                        </Button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
