"use client";

import { useMemo, useState } from "react";
import type { AgendaCompromissoRow } from "@/lib/agenda/types";
import { AGENDA_TIPOS } from "@/lib/agenda/types";
import {
  cancelCompromissoAction,
  concluirCompromissoAction,
  createCompromissoAction,
  reagendarCompromissoAction,
  retornarCompromissoAction,
} from "@/app/admin/agenda/actions";
import { AgendaConcluirForm } from "@/components/admin/agenda/agenda-concluir-form";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form-primitives";
import { formatDateTime } from "@/lib/utils/format";
import {
  adminMutedLabelClass,
  adminPanelClass,
  adminSectionTitleClass,
  adminStatCardClass,
} from "@/components/admin/admin-contrast";
import { surfaceInputDark, surfaceSelectDark } from "@/components/ui/form-primitives";
import type { DisponibilidadeConsultor } from "@/lib/agenda/disponibilidade";
import { ConsultorDisponibilidadeSelect } from "@/components/admin/agenda/consultor-disponibilidade-select";

type Srd = { id: string; nome: string };

type Props = {
  month: number;
  year: number;
  compromissos: AgendaCompromissoRow[];
  srds: Srd[];
  disponibilidades?: DisponibilidadeConsultor[];
  initialDay?: string;
  initialLeadId?: string;
  leadPreview?: { id: string; nome: string } | null;
};

function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function timeFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "10:00";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AgendaView({
  month,
  year,
  compromissos,
  srds,
  disponibilidades = [],
  initialDay,
  initialLeadId,
  leadPreview,
}: Props) {
  const [selected, setSelected] = useState(initialDay ?? `${year}-${pad(month)}-01`);
  const [consultorId, setConsultorId] = useState(srds[0]?.id ?? "");
  const [showNew, setShowNew] = useState(!!initialLeadId);
  const [concluirId, setConcluirId] = useState<string | null>(null);
  const [reagendarId, setReagendarId] = useState<string | null>(null);
  const [retornarId, setRetornarId] = useState<string | null>(null);

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
        <div className={adminStatCardClass}>
          <p className={adminMutedLabelClass}>Hoje</p>
          <p className="text-2xl font-bold text-zinc-50">{hojeItems.length}</p>
        </div>
        <div className={adminStatCardClass}>
          <p className={adminMutedLabelClass}>Atrasados</p>
          <p className="text-2xl font-bold text-amber-400">{atrasados.length}</p>
        </div>
        <div className={adminStatCardClass}>
          <p className={adminMutedLabelClass}>Mês</p>
          <p className="text-2xl font-bold text-zinc-50">{compromissos.length}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className={adminPanelClass}>
          <p className="mb-3 text-sm font-semibold text-zinc-200">
            {pad(month)}/{year}
          </p>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-zinc-400">
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
                    active ? "bg-amber-500 text-zinc-950 font-bold" : "text-zinc-100 hover:bg-zinc-800"
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
            <form action={createCompromissoAction} className={`space-y-3 ${adminPanelClass}`}>
              <h3 className={adminSectionTitleClass}>Novo compromisso</h3>
              <input type="hidden" name="data" value={selected} />
              <input type="hidden" name="mes" value={String(month)} />
              <input type="hidden" name="ano" value={String(year)} />
              {initialLeadId ? <input type="hidden" name="lead_id" value={initialLeadId} /> : null}
              <div>
                <Label>Título</Label>
                <Input name="titulo" required defaultValue="Atendimento" className={surfaceInputDark} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Hora</Label>
                  <Input name="hora" type="time" defaultValue="10:00" required className={surfaceInputDark} />
                </div>
                <div>
                  <Label>Duração (min)</Label>
                  <Input name="duracao_minutos" type="number" defaultValue="60" className={surfaceInputDark} />
                </div>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select name="tipo" defaultValue="Atendimento" className={surfaceSelectDark}>
                  {AGENDA_TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Consultor</Label>
                {srds.length === 0 ? (
                  <>
                    <p className="mt-1 text-sm text-amber-400/90">
                      Nenhum consultor cadastrado. O compromisso será atribuído a você.
                    </p>
                    <input type="hidden" name="consultor_id" value="" />
                  </>
                ) : disponibilidades.length > 0 ? (
                  <ConsultorDisponibilidadeSelect
                    consultores={disponibilidades}
                    selectedId={consultorId || disponibilidades[0]!.usuarioId}
                    onSelect={setConsultorId}
                    dataSelecionada={selected}
                  />
                ) : (
                  <>
                    <Select
                      name="consultor_id"
                      defaultValue={srds[0]?.id ?? ""}
                      required
                      className={surfaceSelectDark}
                    >
                      {srds.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                    </Select>
                    <div className="mt-2 flex gap-3 text-xs text-zinc-200">
                      <label className="flex items-center gap-1.5">
                        <input type="radio" name="modalidade_atendimento" value="presencial" defaultChecked />
                        Presencial
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input type="radio" name="modalidade_atendimento" value="online" />
                        Online
                      </label>
                    </div>
                  </>
                )}
              </div>
              {initialLeadId ? (
                <div className="rounded-lg border border-zinc-700 bg-zinc-950/50 px-3 py-2 text-sm">
                  <p className="text-xs text-zinc-500">Lead vinculado</p>
                  <p className="font-medium text-zinc-100">{leadPreview?.nome ?? initialLeadId}</p>
                </div>
              ) : (
                <div>
                  <Label>Lead (UUID — opcional)</Label>
                  <Input name="lead_id" placeholder="cole o id do lead" className={surfaceInputDark} />
                </div>
              )}
              <div>
                <Label>Local</Label>
                <Input name="local" className={surfaceInputDark} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea name="descricao" rows={2} className={surfaceInputDark} />
              </div>
              <div className="flex gap-2">
                <AdminFormSubmitButton label="Salvar" />
                <Button type="button" variant="outline" onClick={() => setShowNew(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          ) : null}

          <div className={adminPanelClass}>
            <h3 className={adminSectionTitleClass}>Compromissos — {selected}</h3>
            {dayItems.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-400">Nenhum compromisso neste dia.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {dayItems.map((c) => (
                  <li key={c.id} className="rounded-lg border border-zinc-700 bg-zinc-950/60 p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-zinc-50">{c.titulo}</p>
                        <p className="text-xs text-zinc-400">
                          {formatDateTime(c.data_inicio, null)} · {c.tipo} · {c.status}
                          {(c as { modalidade_atendimento?: string | null }).modalidade_atendimento
                            ? ` · ${(c as { modalidade_atendimento?: string }).modalidade_atendimento}`
                            : ""}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {c.leads?.nome ?? "Sem lead"} · {c.usuarios?.nome ?? "Consultor"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {c.status === "agendado" ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setReagendarId(reagendarId === c.id ? null : c.id);
                                setRetornarId(null);
                                setConcluirId(null);
                              }}
                            >
                              Reagendar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRetornarId(retornarId === c.id ? null : c.id);
                                setReagendarId(null);
                                setConcluirId(null);
                              }}
                            >
                              Retornar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="gold"
                              onClick={() => {
                                setConcluirId(concluirId === c.id ? null : c.id);
                                setReagendarId(null);
                                setRetornarId(null);
                              }}
                            >
                              Concluir
                            </Button>
                            <form action={cancelCompromissoAction.bind(null, c.id)}>
                              <AdminFormSubmitButton
                                size="sm"
                                variant="outline"
                                label="Cancelar"
                                pendingLabel="Cancelando…"
                              />
                            </form>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {reagendarId === c.id ? (
                      <form
                        action={reagendarCompromissoAction.bind(null, c.id)}
                        className="mt-3 space-y-2 border-t border-zinc-800 pt-3"
                      >
                        <p className="text-xs font-medium text-zinc-400">Nova data e horário</p>
                        <input type="hidden" name="mes" value={String(month)} />
                        <input type="hidden" name="ano" value={String(year)} />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>Data</Label>
                            <Input
                              name="data"
                              type="date"
                              defaultValue={c.data_inicio.slice(0, 10)}
                              required
                              className={surfaceInputDark}
                            />
                          </div>
                          <div>
                            <Label>Hora</Label>
                            <Input
                              name="hora"
                              type="time"
                              defaultValue={timeFromIso(c.data_inicio)}
                              required
                              className={surfaceInputDark}
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Duração (min)</Label>
                          <Input
                            name="duracao_minutos"
                            type="number"
                            defaultValue={String(c.duracao_minutos ?? 60)}
                            className={surfaceInputDark}
                          />
                        </div>
                        <AdminFormSubmitButton size="sm" label="Salvar reagendamento" pendingLabel="Salvando…" />
                      </form>
                    ) : null}
                    {retornarId === c.id ? (
                      <form
                        action={retornarCompromissoAction.bind(null, c.id)}
                        className="mt-3 space-y-2 border-t border-zinc-800 pt-3"
                      >
                        <p className="text-xs font-medium text-zinc-400">Agendar retorno (novo compromisso)</p>
                        <input type="hidden" name="mes" value={String(month)} />
                        <input type="hidden" name="ano" value={String(year)} />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>Data</Label>
                            <Input name="data" type="date" required className={surfaceInputDark} />
                          </div>
                          <div>
                            <Label>Hora</Label>
                            <Input name="hora" type="time" defaultValue="10:00" required className={surfaceInputDark} />
                          </div>
                        </div>
                        <div>
                          <Label>Duração (min)</Label>
                          <Input name="duracao_minutos" type="number" defaultValue="30" className={surfaceInputDark} />
                        </div>
                        <Textarea name="descricao" rows={2} placeholder="Observação do retorno" className={surfaceInputDark} />
                        <AdminFormSubmitButton size="sm" label="Criar retorno" pendingLabel="Agendando…" />
                      </form>
                    ) : null}
                    {concluirId === c.id ? (
                      <AgendaConcluirForm action={concluirCompromissoAction.bind(null, c.id)} />
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
