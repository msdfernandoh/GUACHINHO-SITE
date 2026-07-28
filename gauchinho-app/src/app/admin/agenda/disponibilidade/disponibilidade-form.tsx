"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  DIAS_SEMANA,
  MODALIDADES_ATENDIMENTO,
  gerarDatasDiaSemana,
  isDataBloqueada,
  slotsDoDia,
  statusDiaCalendario,
  type BloqueioAgenda,
  type ModalidadeAtendimento,
  type SlotDisponibilidade,
} from "@/lib/agenda/disponibilidade";
import {
  AgendaMonthCalendar,
  shiftMonth,
} from "@/components/admin/agenda/agenda-month-calendar";
import { saveMinhaDisponibilidadeAction } from "./actions";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { Button, Input, Label, Textarea } from "@/components/ui/form-primitives";

type Props = {
  initialSlots: SlotDisponibilidade[];
  initialBloqueios: BloqueioAgenda[];
  initialObservacao: string | null;
  initialModalidade: ModalidadeAtendimento;
  /** YYYY-MM-DD com compromisso do consultor (amarelo no calendário). */
  datasComCompromisso?: string[];
};

type DraftSlot = {
  key: string;
  modo: "semana" | "data";
  dia_semana: number;
  data_especifica: string;
  hora_inicio: string;
  hora_fim: string;
  modalidade_atendimento: ModalidadeAtendimento;
};

type DraftBloqueio = {
  key: string;
  data_inicio: string;
  data_fim: string;
  motivo: string;
};

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

export function DisponibilidadeForm({
  initialSlots,
  initialBloqueios,
  initialObservacao,
  initialModalidade,
  datasComCompromisso = [],
}: Props) {
  const now = new Date();
  const [tab, setTab] = useState<"calendario" | "listas">("calendario");
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(hojeIso());
  const [blockMotivo, setBlockMotivo] = useState("Indisponível");
  const [liberarInicio, setLiberarInicio] = useState("09:00");
  const [liberarFim, setLiberarFim] = useState("18:00");

  const [slots, setSlots] = useState<DraftSlot[]>(() =>
    initialSlots.length
      ? initialSlots.map((s) => ({
          key: s.id ?? newKey(),
          modo: s.data_especifica ? "data" : "semana",
          dia_semana: s.dia_semana ?? 1,
          data_especifica: s.data_especifica ?? hojeIso(),
          hora_inicio: s.hora_inicio.slice(0, 5),
          hora_fim: s.hora_fim.slice(0, 5),
          modalidade_atendimento: s.modalidade_atendimento ?? "ambos",
        }))
      : [
          {
            key: newKey(),
            modo: "semana" as const,
            dia_semana: 1,
            data_especifica: hojeIso(),
            hora_inicio: "09:00",
            hora_fim: "12:00",
            modalidade_atendimento: "ambos" as const,
          },
        ],
  );
  const [bloqueios, setBloqueios] = useState<DraftBloqueio[]>(() =>
    initialBloqueios.map((b) => ({
      key: b.id ?? newKey(),
      data_inicio: b.data_inicio,
      data_fim: b.data_fim,
      motivo: b.motivo,
    })),
  );
  const [observacao, setObservacao] = useState(initialObservacao ?? "");
  const [modalidadePadrao, setModalidadePadrao] = useState<ModalidadeAtendimento>(initialModalidade);
  const [genDia, setGenDia] = useState(3);
  const [genMeses, setGenMeses] = useState(0);
  const [genInicio, setGenInicio] = useState("09:00");
  const [genFim, setGenFim] = useState("12:00");
  const [msg, setMsg] = useState<string | null>(null);

  const compromissoSet = useMemo(() => new Set(datasComCompromisso), [datasComCompromisso]);

  const slotsAsDomain = useMemo(
    () =>
      slots.map(
        (s): SlotDisponibilidade => ({
          dia_semana: s.modo === "semana" ? s.dia_semana : null,
          data_especifica: s.modo === "data" ? s.data_especifica : null,
          hora_inicio: s.hora_inicio,
          hora_fim: s.hora_fim,
          ativo: true,
          modalidade_atendimento: s.modalidade_atendimento,
        }),
      ),
    [slots],
  );

  const bloqueiosAsDomain = useMemo(
    () =>
      bloqueios.map(
        (b): BloqueioAgenda => ({
          data_inicio: b.data_inicio,
          data_fim: b.data_fim,
          hora_inicio: null,
          hora_fim: null,
          motivo: b.motivo || "Bloqueado",
        }),
      ),
    [bloqueios],
  );

  const dayStatus = statusDiaCalendario({
    dataIso: selectedDay,
    slots: slotsAsDomain,
    bloqueios: bloqueiosAsDomain,
    temCompromisso: compromissoSet.has(selectedDay),
  });
  const daySlots = slotsDoDia(selectedDay, slotsAsDomain);
  const dayBlock = isDataBloqueada(selectedDay, bloqueiosAsDomain);

  function liberarDia(data: string) {
    setSlots((prev) => {
      const exists = prev.some(
        (p) =>
          p.modo === "data" &&
          p.data_especifica === data &&
          p.hora_inicio === liberarInicio &&
          p.hora_fim === liberarFim,
      );
      if (exists) return prev;
      return [
        ...prev,
        {
          key: newKey(),
          modo: "data" as const,
          dia_semana: new Date(`${data}T12:00:00`).getDay(),
          data_especifica: data,
          hora_inicio: liberarInicio,
          hora_fim: liberarFim,
          modalidade_atendimento: modalidadePadrao,
        },
      ];
    });
    // Se havia bloqueio só neste dia, remove
    setBloqueios((prev) =>
      prev.filter((b) => !(b.data_inicio === data && b.data_fim === data)),
    );
    setMsg(`Dia ${data.split("-").reverse().join("/")} liberado. Lembre de salvar.`);
  }

  function bloquearDia(data: string) {
    setBloqueios((prev) => {
      if (prev.some((b) => data >= b.data_inicio && data <= b.data_fim)) return prev;
      return [
        ...prev,
        { key: newKey(), data_inicio: data, data_fim: data, motivo: blockMotivo.trim() || "Indisponível" },
      ];
    });
    setMsg(`Dia ${data.split("-").reverse().join("/")} bloqueado. Lembre de salvar.`);
  }

  function removerBloqueioDoDia(data: string) {
    setBloqueios((prev) =>
      prev.flatMap((b) => {
        if (data < b.data_inicio || data > b.data_fim) return [b];
        // Bloqueio de um dia: remove
        if (b.data_inicio === b.data_fim) return [];
        // Período: encolhe removendo só o dia (simplificado — remove o período inteiro se for o caso)
        if (b.data_inicio === data) {
          const next = new Date(`${data}T12:00:00`);
          next.setDate(next.getDate() + 1);
          const nextIso = next.toISOString().slice(0, 10);
          if (nextIso > b.data_fim) return [];
          return [{ ...b, data_inicio: nextIso }];
        }
        if (b.data_fim === data) {
          const prevD = new Date(`${data}T12:00:00`);
          prevD.setDate(prevD.getDate() - 1);
          return [{ ...b, data_fim: prevD.toISOString().slice(0, 10) }];
        }
        // Meio do período: remove o período todo e avisa
        return [];
      }),
    );
    setMsg("Bloqueio removido deste dia. Lembre de salvar.");
  }

  function removerSlotsDataDoDia(data: string) {
    setSlots((prev) => prev.filter((s) => !(s.modo === "data" && s.data_especifica === data)));
    setMsg("Horários específicos deste dia removidos. (Recorrência semanal permanece.) Lembre de salvar.");
  }

  const slotsJson = useMemo(
    () =>
      JSON.stringify(
        slots.map((s) => ({
          dia_semana: s.modo === "semana" ? s.dia_semana : null,
          data_especifica: s.modo === "data" ? s.data_especifica : null,
          hora_inicio: s.hora_inicio,
          hora_fim: s.hora_fim,
          ativo: true,
          modalidade_atendimento: s.modalidade_atendimento,
        })),
      ),
    [slots],
  );

  const bloqueiosJson = useMemo(
    () =>
      JSON.stringify(
        bloqueios.map((b) => ({
          data_inicio: b.data_inicio,
          data_fim: b.data_fim,
          motivo: b.motivo,
        })),
      ),
    [bloqueios],
  );

  function addSlotSemana(dia = 1) {
    setSlots((prev) => [
      ...prev,
      {
        key: newKey(),
        modo: "semana",
        dia_semana: dia,
        data_especifica: hojeIso(),
        hora_inicio: "09:00",
        hora_fim: "18:00",
        modalidade_atendimento: modalidadePadrao,
      },
    ]);
  }

  function addSlotData() {
    setSlots((prev) => [
      ...prev,
      {
        key: newKey(),
        modo: "data",
        dia_semana: 1,
        data_especifica: selectedDay || hojeIso(),
        hora_inicio: "09:00",
        hora_fim: "12:00",
        modalidade_atendimento: modalidadePadrao,
      },
    ]);
  }

  function gerarRecorrencia() {
    const datas = gerarDatasDiaSemana({ diaSemana: genDia, mesesAFrente: genMeses });
    if (!datas.length) {
      setMsg("Nenhuma data encontrada para o período escolhido.");
      return;
    }
    setSlots((prev) => {
      const existentes = new Set(
        prev.filter((p) => p.modo === "data").map((p) => `${p.data_especifica}|${p.hora_inicio}|${p.hora_fim}`),
      );
      const novos: DraftSlot[] = [];
      for (const data of datas) {
        const keyDup = `${data}|${genInicio}|${genFim}`;
        if (existentes.has(keyDup)) continue;
        novos.push({
          key: newKey(),
          modo: "data",
          dia_semana: genDia,
          data_especifica: data,
          hora_inicio: genInicio,
          hora_fim: genFim,
          modalidade_atendimento: modalidadePadrao,
        });
      }
      return [...prev, ...novos];
    });
    const label = DIAS_SEMANA.find((d) => d.value === genDia)?.label ?? "dia";
    const periodo =
      genMeses === 0 ? "mês atual" : genMeses === 1 ? "mês atual + 1" : `mês atual + ${genMeses}`;
    setMsg(`Adicionadas as ${label.toLowerCase()}s do ${periodo} (${datas.length} data(s)). Lembre de salvar.`);
  }

  function addBloqueio() {
    const hoje = selectedDay || hojeIso();
    setBloqueios((prev) => [
      ...prev,
      { key: newKey(), data_inicio: hoje, data_fim: hoje, motivo: "" },
    ]);
  }

  async function submitAction(formData: FormData) {
    setMsg(null);
    formData.set("slots_json", slotsJson);
    formData.set("bloqueios_json", bloqueiosJson);
    formData.set("observacao", observacao);
    formData.set("modalidade_padrao", modalidadePadrao);
    try {
      await saveMinhaDisponibilidadeAction(formData);
      setMsg("Disponibilidade salva. O SDR verá horários, datas e bloqueios na Agenda.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }

  const slotsSemana = slots.filter((s) => s.modo === "semana");
  const slotsData = slots.filter((s) => s.modo === "data");

  const statusLabel =
    dayStatus === "livre"
      ? "Livre para agendamento"
      : dayStatus === "compromisso"
        ? "Com compromisso"
        : dayStatus === "bloqueado"
          ? "Bloqueado"
          : "Sem horário cadastrado";

  return (
    <form action={submitAction} className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
        <button
          type="button"
          onClick={() => setTab("calendario")}
          className={
            tab === "calendario"
              ? "rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950"
              : "rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:border-amber-500/40"
          }
        >
          Calendário do mês
        </button>
        <button
          type="button"
          onClick={() => setTab("listas")}
          className={
            tab === "listas"
              ? "rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950"
              : "rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:border-amber-500/40"
          }
        >
          Horários e listas
        </button>
      </div>

      {tab === "calendario" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 sm:p-5">
            <AgendaMonthCalendar
              year={calYear}
              month={calMonth}
              selected={selectedDay}
              size="lg"
              statusForDay={(iso) =>
                statusDiaCalendario({
                  dataIso: iso,
                  slots: slotsAsDomain,
                  bloqueios: bloqueiosAsDomain,
                  temCompromisso: compromissoSet.has(iso),
                })
              }
              onSelectDay={setSelectedDay}
              onPrevMonth={() => {
                const s = shiftMonth(calYear, calMonth, -1);
                setCalYear(s.year);
                setCalMonth(s.month);
              }}
              onNextMonth={() => {
                const s = shiftMonth(calYear, calMonth, 1);
                setCalYear(s.year);
                setCalMonth(s.month);
              }}
            />
          </div>

          <div className="space-y-4 rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                {selectedDay.split("-").reverse().join("/")}
              </h2>
              <p
                className={`mt-1 text-sm font-medium ${
                  dayStatus === "livre"
                    ? "text-emerald-400"
                    : dayStatus === "compromisso"
                      ? "text-amber-400"
                      : dayStatus === "bloqueado"
                        ? "text-red-400"
                        : "text-zinc-400"
                }`}
              >
                {statusLabel}
              </p>
              {dayBlock ? (
                <p className="mt-1 text-xs text-red-300/90">Motivo: {dayBlock.motivo}</p>
              ) : null}
            </div>

            {daySlots.length > 0 ? (
              <ul className="space-y-1 text-xs text-zinc-300">
                {daySlots.map((s, i) => (
                  <li key={i} className="rounded-md bg-zinc-950/60 px-2 py-1.5">
                    {s.hora_inicio.slice(0, 5)}–{s.hora_fim.slice(0, 5)}
                    {s.data_especifica ? " · data específica" : " · semanal"}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-500">Nenhum horário neste dia.</p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Início</Label>
                <Input type="time" value={liberarInicio} onChange={(e) => setLiberarInicio(e.target.value)} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="time" value={liberarFim} onChange={(e) => setLiberarFim(e.target.value)} />
              </div>
            </div>

            <Button type="button" variant="gold" className="w-full" onClick={() => liberarDia(selectedDay)}>
              Liberar este dia
            </Button>

            <div>
              <Label>Motivo do bloqueio</Label>
              <Input
                value={blockMotivo}
                onChange={(e) => setBlockMotivo(e.target.value)}
                placeholder="Ex.: Férias"
              />
            </div>

            {dayStatus === "bloqueado" ? (
              <Button
                type="button"
                variant="outline"
                className="w-full border-emerald-500/40 text-emerald-300"
                onClick={() => removerBloqueioDoDia(selectedDay)}
              >
                Desbloquear este dia
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full border-red-500/40 text-red-300"
                onClick={() => bloquearDia(selectedDay)}
              >
                Bloquear este dia
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => removerSlotsDataDoDia(selectedDay)}
            >
              Remover horários específicos do dia
            </Button>

            <p className="text-[11px] leading-relaxed text-zinc-500">
              Verde = livre · Amarelo = compromisso · Vermelho = bloqueado. Alterações só valem após salvar.
            </p>
          </div>
        </div>
      ) : null}

      {tab === "listas" ? (
        <>
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Tipo de atendimento padrão</h2>
        <p className="mt-1 text-xs text-zinc-500">Usado como padrão ao abrir agenda e nos horários novos.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {MODALIDADES_ATENDIMENTO.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setModalidadePadrao(m.value)}
              className={
                modalidadePadrao === m.value
                  ? "rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950"
                  : "rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300"
              }
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Recorrência semanal</h2>
            <p className="text-xs text-zinc-500">Horários que se repetem toda semana (ex.: toda terça 10h–12h).</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => addSlotSemana()}>
            <Plus className="mr-1 h-4 w-4" />
            Adicionar
          </Button>
        </div>
        <div className="space-y-2">
          {slotsSemana.map((s) => (
            <SlotRow
              key={s.key}
              slot={s}
              onChange={(patch) =>
                setSlots((prev) => prev.map((x) => (x.key === s.key ? { ...x, ...patch } : x)))
              }
              onRemove={() => setSlots((prev) => prev.filter((x) => x.key !== s.key))}
            />
          ))}
          {!slotsSemana.length ? <p className="text-xs text-zinc-500">Nenhum horário semanal.</p> : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {DIAS_SEMANA.filter((d) => d.value >= 1 && d.value <= 5).map((d) => (
            <Button key={d.value} type="button" size="sm" variant="outline" onClick={() => addSlotSemana(d.value)}>
              + {d.short}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Datas específicas</h2>
            <p className="text-xs text-zinc-500">
              Marque dias concretos ou gere todas as quartas do mês atual / próximos meses.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addSlotData}>
            <Plus className="mr-1 h-4 w-4" />
            Data avulsa
          </Button>
        </div>

        <div className="mb-4 grid gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label>Dia da semana</Label>
            <select
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              value={genDia}
              onChange={(e) => setGenDia(Number(e.target.value))}
            >
              {DIAS_SEMANA.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Período</Label>
            <select
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              value={genMeses}
              onChange={(e) => setGenMeses(Number(e.target.value))}
            >
              <option value={0}>Só mês atual</option>
              <option value={1}>Mês atual + 1</option>
              <option value={2}>Mês atual + 2</option>
            </select>
          </div>
          <div>
            <Label>Início</Label>
            <Input type="time" value={genInicio} onChange={(e) => setGenInicio(e.target.value)} />
          </div>
          <div>
            <Label>Fim</Label>
            <Input type="time" value={genFim} onChange={(e) => setGenFim(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="button" variant="gold" className="w-full" onClick={gerarRecorrencia}>
              Gerar datas
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {slotsData.map((s) => (
            <SlotRow
              key={s.key}
              slot={s}
              onChange={(patch) =>
                setSlots((prev) => prev.map((x) => (x.key === s.key ? { ...x, ...patch } : x)))
              }
              onRemove={() => setSlots((prev) => prev.filter((x) => x.key !== s.key))}
            />
          ))}
          {!slotsData.length ? <p className="text-xs text-zinc-500">Nenhuma data específica.</p> : null}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Fechar período (bloqueio)</h2>
            <p className="text-xs text-zinc-500">Férias, congresso, folga — o SDR vê o motivo ao agendar.</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addBloqueio}>
            <Plus className="mr-1 h-4 w-4" />
            Bloquear período
          </Button>
        </div>
        <div className="space-y-2">
          {bloqueios.map((b) => (
            <div
              key={b.key}
              className="grid grid-cols-1 items-end gap-2 rounded-lg border border-red-500/20 bg-zinc-950/50 p-3 sm:grid-cols-[1fr_1fr_1.4fr_auto]"
            >
              <div>
                <Label>De</Label>
                <Input
                  type="date"
                  value={b.data_inicio}
                  onChange={(e) =>
                    setBloqueios((prev) =>
                      prev.map((x) => (x.key === b.key ? { ...x, data_inicio: e.target.value } : x)),
                    )
                  }
                />
              </div>
              <div>
                <Label>Até</Label>
                <Input
                  type="date"
                  value={b.data_fim}
                  onChange={(e) =>
                    setBloqueios((prev) =>
                      prev.map((x) => (x.key === b.key ? { ...x, data_fim: e.target.value } : x)),
                    )
                  }
                />
              </div>
              <div>
                <Label>Motivo *</Label>
                <Input
                  value={b.motivo}
                  placeholder="Ex.: Férias"
                  onChange={(e) =>
                    setBloqueios((prev) =>
                      prev.map((x) => (x.key === b.key ? { ...x, motivo: e.target.value } : x)),
                    )
                  }
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-red-500/40 text-red-300"
                onClick={() => setBloqueios((prev) => prev.filter((x) => x.key !== b.key))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {!bloqueios.length ? <p className="text-xs text-zinc-500">Nenhum período bloqueado.</p> : null}
        </div>
      </div>
        </>
      ) : null}

      <div>
        <Label>Observação para o SDR (opcional)</Label>
        <Textarea
          rows={3}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex.: Prefiro ligações pela manhã; sexta só até 16h."
        />
      </div>

      <input type="hidden" name="slots_json" value={slotsJson} />
      <input type="hidden" name="bloqueios_json" value={bloqueiosJson} />
      <input type="hidden" name="observacao" value={observacao} />
      <input type="hidden" name="modalidade_padrao" value={modalidadePadrao} />

      {msg ? (
        <p
          className={
            /salva|liberado|bloqueado|Adicionadas|removid/i.test(msg) && !/Erro|inválid/i.test(msg)
              ? "text-sm text-emerald-400"
              : "text-sm text-amber-300"
          }
        >
          {msg}
        </p>
      ) : null}

      <AdminFormSubmitButton label="Salvar disponibilidade" pendingLabel="Salvando…" />
    </form>
  );
}

function SlotRow({
  slot,
  onChange,
  onRemove,
}: {
  slot: DraftSlot;
  onChange: (patch: Partial<DraftSlot>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-1 items-end gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
      {slot.modo === "semana" ? (
        <div>
          <Label>Dia</Label>
          <select
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={slot.dia_semana}
            onChange={(e) => onChange({ dia_semana: Number(e.target.value) })}
          >
            {DIAS_SEMANA.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <Label>Data</Label>
          <Input
            type="date"
            value={slot.data_especifica}
            onChange={(e) => onChange({ data_especifica: e.target.value })}
          />
        </div>
      )}
      <div>
        <Label>Início</Label>
        <Input type="time" value={slot.hora_inicio} onChange={(e) => onChange({ hora_inicio: e.target.value })} />
      </div>
      <div>
        <Label>Fim</Label>
        <Input type="time" value={slot.hora_fim} onChange={(e) => onChange({ hora_fim: e.target.value })} />
      </div>
      <div>
        <Label>Atendimento</Label>
        <select
          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          value={slot.modalidade_atendimento}
          onChange={(e) => onChange({ modalidade_atendimento: e.target.value as ModalidadeAtendimento })}
        >
          {MODALIDADES_ATENDIMENTO.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <Button type="button" size="sm" variant="outline" className="border-red-500/40 text-red-300" onClick={onRemove}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
