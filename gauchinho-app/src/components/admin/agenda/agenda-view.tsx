"use client";

import { useActionState, useMemo, useState } from "react";
import type { AgendaCompromissoRow } from "@/lib/agenda/types";
import { AGENDA_TIPOS } from "@/lib/agenda/types";
import {
  cancelCompromissoAction,
  concluirCompromissoAction,
  createCompromissoStateAction,
  reagendarCompromissoAction,
  retornarCompromissoAction,
  marcarNaoCompareceuAction,
  marcarRealizadoAgendaAction,
  reenviarCompromissoGoogleAction,
} from "@/app/admin/agenda/actions";
import { AgendaConcluirForm } from "@/components/admin/agenda/agenda-concluir-form";
import {
  AgendaMonthCalendar,
  agendaMonthHref,
  shiftMonth,
} from "@/components/admin/agenda/agenda-month-calendar";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form-primitives";
import { agendaDateKey, agendaTimeKey, AGENDA_TIME_ZONE } from "@/lib/agenda/timezone";
import { AgendaDurationFields } from "./agenda-duration-fields";
import {
  adminMutedLabelClass,
  adminPanelClass,
  adminSectionTitleClass,
  adminStatCardClass,
} from "@/components/admin/admin-contrast";
import { surfaceInputDark, surfaceSelectDark } from "@/components/ui/form-primitives";
import {
  statusDiaCalendario,
  type DisponibilidadeConsultor,
} from "@/lib/agenda/disponibilidade";
import { ConsultorDisponibilidadeSelect } from "@/components/admin/agenda/consultor-disponibilidade-select";

type Srd = { id: string; nome: string };

type Props = {
  requestId: string;
  month: number;
  year: number;
  compromissos: AgendaCompromissoRow[];
  srds: Srd[];
  disponibilidades?: DisponibilidadeConsultor[];
  initialDay?: string;
  initialLeadId?: string;
  leadPreview?: { id: string; nome: string } | null;
  currentUserId: string;
  canViewTeam: boolean;
  leadOptions: Array<{ id: string; nome: string; whatsapp: string | null }>;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function AgendaView({
  requestId,
  month,
  year,
  compromissos,
  srds,
  disponibilidades = [],
  initialDay,
  initialLeadId,
  leadPreview,
  currentUserId,
  canViewTeam,
  leadOptions,
}: Props) {
  const [selected, setSelected] = useState(initialDay ?? `${year}-${pad(month)}-01`);
  const [consultorId, setConsultorId] = useState(currentUserId);
  const [escopo, setEscopo] = useState("INDIVIDUAL");
  const [showNew, setShowNew] = useState(!!initialLeadId);
  const [concluirId, setConcluirId] = useState<string | null>(null);
  const [reagendarId, setReagendarId] = useState<string | null>(null);
  const [retornarId, setRetornarId] = useState<string | null>(null);
  const [filtroConsultor, setFiltroConsultor] = useState(canViewTeam ? "todos" : currentUserId);
  const [filtroStatus, setFiltroStatus] = useState("ativos");
  const [createState, createAction] = useActionState(createCompromissoStateAction, { error: null });

  const compromissosFiltrados = useMemo(() => compromissos.filter((c) => {
    if (filtroConsultor !== "todos" && c.consultor_id !== filtroConsultor && !c.participantes?.some((p) => p.usuario_id === filtroConsultor)) return false;
    if (filtroStatus === "ativos") return c.status === "agendado";
    if (filtroStatus !== "todos") return c.status === filtroStatus;
    return true;
  }), [compromissos, filtroConsultor, filtroStatus]);

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaCompromissoRow[]>();
    for (const c of compromissosFiltrados) {
      for (let day = 1; day <= new Date(year, month, 0).getDate(); day++) {
        const d = `${year}-${pad(month)}-${pad(day)}`;
        if (d < agendaDateKey(c.data_inicio) || d > agendaDateKey(new Date(Date.parse(c.data_fim ?? c.data_inicio) - (c.data_fim ? 1 : 0)))) continue;
        const list = map.get(d) ?? [];
        list.push(c);
        map.set(d, list);
      }
    }
    return map;
  }, [compromissosFiltrados, year, month]);

  const dispAtiva = useMemo(() => {
    const id = consultorId || disponibilidades[0]?.usuarioId;
    return disponibilidades.find((d) => d.usuarioId === id) ?? null;
  }, [consultorId, disponibilidades]);

  const dayItems = byDay.get(selected) ?? [];
  const hoje = agendaDateKey(new Date());
  const atrasados = compromissosFiltrados.filter((c) => c.status === "agendado" && agendaDateKey(c.data_fim ?? c.data_inicio) < hoje);
  const hojeItems = byDay.get(hoje) ?? [];

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const navExtra = {
    lead: initialLeadId,
    dia: selected.startsWith(`${year}-${pad(month)}`) ? undefined : selected,
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
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
          <p className="text-2xl font-bold text-zinc-50">{compromissosFiltrados.length}</p>
        </div>
      </div>

      <div className={`${adminPanelClass} grid gap-3 sm:grid-cols-2`}>
        <div>
          <Label>Agenda exibida</Label>
          <Select value={filtroConsultor} onChange={(e) => setFiltroConsultor(e.target.value)} className={`${surfaceSelectDark} mt-1`}>
            {canViewTeam ? <option value="todos">Toda a equipe</option> : null}
            {srds.map((s) => <option key={s.id} value={s.id}>{s.id === currentUserId ? `${s.nome} (minha agenda)` : s.nome}</option>)}
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className={`${surfaceSelectDark} mt-1`}>
            <option value="ativos">Pendentes / agendados</option>
            <option value="todos">Todos os status</option>
            <option value="concluido">Realizados</option>
            <option value="cancelado">Cancelados</option>
            <option value="nao_compareceu">Não compareceu</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className={adminPanelClass}>
          <AgendaMonthCalendar
            year={year}
            month={month}
            selected={selected}
            size="lg"
            prevHref={agendaMonthHref(prev.year, prev.month, navExtra)}
            nextHref={agendaMonthHref(next.year, next.month, navExtra)}
            statusForDay={(iso) =>
              statusDiaCalendario({
                dataIso: iso,
                slots: dispAtiva?.slots ?? [],
                bloqueios: dispAtiva?.bloqueios ?? [],
                temCompromisso: (byDay.get(iso)?.length ?? 0) > 0,
              })
            }
            onSelectDay={(iso) => {
              setSelected(iso);
              setShowNew(false);
            }}
          />
          {srds.length > 1 && disponibilidades.length > 0 ? (
            <div className="mt-4 border-t border-zinc-800 pt-3">
              <Label>Cores do calendário — consultor</Label>
              <Select
                value={consultorId || srds[0]?.id}
                onChange={(e) => setConsultorId(e.target.value)}
                className={`${surfaceSelectDark} mt-1`}
              >
                {srds.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <Button type="button" className="mt-4 w-full" variant="gold" onClick={() => setShowNew(true)}>
            Novo compromisso — {selected}
          </Button>
        </div>

        <div className="space-y-4">
          {showNew ? (
            <form action={createAction} className={`space-y-3 ${adminPanelClass}`}>
              <h3 className={adminSectionTitleClass}>Novo compromisso</h3>
              {createState.error ? (
                <p role="alert" className="rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-200">
                  {createState.error}
                </p>
              ) : null}
              <input type="hidden" name="data" value={selected} />
              <input type="hidden" name="request_id" value={requestId} />
              <input type="hidden" name="mes" value={String(month)} />
              <input type="hidden" name="ano" value={String(year)} />
              {initialLeadId ? <input type="hidden" name="lead_id" value={initialLeadId} /> : null}
              <div>
                <Label>Título</Label>
                <Input name="titulo" required defaultValue="Atendimento" className={surfaceInputDark} />
              </div>
              <div>
                <Label htmlFor="agenda-escopo">Agendar para</Label>
                <Select id="agenda-escopo" name="escopo" value={escopo} onChange={(e) => setEscopo(e.target.value)} className={surfaceSelectDark}>
                  <option value="INDIVIDUAL">Uma pessoa</option>
                  {canViewTeam ? <option value="EQUIPE">Toda a equipe</option> : null}
                </Select>
                {escopo === "EQUIPE" ? <p className="mt-2 text-xs text-amber-300">Inclui todos os membros ativos com acesso à agenda nesta empresa. Ideal para inaugurações e reuniões gerais. Novos membros não são adicionados retroativamente.</p> : null}
              </div>
              <AgendaDurationFields />
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
              <div hidden={escopo === "EQUIPE"}>
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
                  <Label>Lead ou cliente (opcional)</Label>
                  <Select name="lead_id" defaultValue="" className={surfaceSelectDark}>
                    <option value="">Compromisso sem lead</option>
                    {leadOptions.map((lead) => (
                      <option key={lead.id} value={lead.id}>{lead.nome}{lead.whatsapp ? ` · ${lead.whatsapp}` : ""}</option>
                    ))}
                  </Select>
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
                          {c.dia_inteiro ? "Dia todo" : new Date(c.data_inicio).toLocaleString("pt-BR", { timeZone: AGENDA_TIME_ZONE, dateStyle: "short", timeStyle: "short" })} · {c.tipo} · {c.status === "concluido" ? "realizado" : c.status}
                          {(c as { modalidade_atendimento?: string | null }).modalidade_atendimento
                            ? ` · ${(c as { modalidade_atendimento?: string }).modalidade_atendimento}`
                            : ""}
                        </p>
                        {c.escopo === "EQUIPE" ? <p className="mt-1 text-xs text-amber-300">Toda a equipe · {c.participantes?.length ?? 0} participantes{c.participantes?.length ? `: ${c.participantes.map((p) => p.nome).join(", ")}` : ""}</p> : null}
                        {c.origem === "GOOGLE" ? <p className="mt-1 text-xs text-sky-300">Importado do Google · alterações devem ser feitas na agenda de origem.</p> : null}
                        <p className="text-xs text-zinc-400">
                          {c.leads?.nome ?? "Sem lead"} · {c.usuarios?.nome ?? "Consultor"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {c.origem !== "GOOGLE" && (canViewTeam || c.consultor_id === currentUserId) && ["agendado", "cancelado"].includes(c.status) ? <form action={reenviarCompromissoGoogleAction.bind(null, c.id)}><AdminFormSubmitButton size="sm" variant="outline" label="Sincronizar Google" pendingLabel="Sincronizando…" /></form> : null}
                        {c.status === "agendado" && c.origem !== "GOOGLE" && (canViewTeam || c.consultor_id === currentUserId) ? (
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
                            {!c.lead_id ? <form action={marcarRealizadoAgendaAction.bind(null, c.id)}><AdminFormSubmitButton size="sm" variant="gold" label="Marcar realizado" pendingLabel="Salvando…" /></form> : <Button
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
                            </Button>}
                            <form action={marcarNaoCompareceuAction.bind(null, c.id)}>
                              <AdminFormSubmitButton size="sm" variant="outline" label="Não compareceu" pendingLabel="Salvando…" />
                            </form>
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
                              defaultValue={agendaDateKey(c.data_inicio)}
                              required
                              className={surfaceInputDark}
                            />
                          </div>
                        </div>
                        <AgendaDurationFields initialMinutes={c.duracao_minutos ?? 60} initialAllDay={c.dia_inteiro} initialTime={agendaTimeKey(c.data_inicio)} />
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
                        </div>
                        <AgendaDurationFields initialMinutes={30} />
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
