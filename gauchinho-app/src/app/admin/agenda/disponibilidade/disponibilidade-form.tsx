"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  DIAS_SEMANA,
  MODALIDADES_ATENDIMENTO,
  gerarDatasDiaSemana,
  type BloqueioAgenda,
  type ModalidadeAtendimento,
  type SlotDisponibilidade,
} from "@/lib/agenda/disponibilidade";
import { saveMinhaDisponibilidadeAction } from "./actions";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { Button, Input, Label, Textarea } from "@/components/ui/form-primitives";

type Props = {
  initialSlots: SlotDisponibilidade[];
  initialBloqueios: BloqueioAgenda[];
  initialObservacao: string | null;
  initialModalidade: ModalidadeAtendimento;
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
}: Props) {
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
        data_especifica: hojeIso(),
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
    const hoje = hojeIso();
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

  return (
    <form action={submitAction} className="space-y-6">
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
        <p className={msg.includes("salva") || msg.startsWith("Adicionadas") ? "text-sm text-emerald-400" : "text-sm text-amber-300"}>
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
