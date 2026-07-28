"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { DIAS_SEMANA, type SlotDisponibilidade } from "@/lib/agenda/disponibilidade";
import { saveMinhaDisponibilidadeAction } from "./actions";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { Button, Input, Label, Textarea } from "@/components/ui/form-primitives";

type Props = {
  initialSlots: SlotDisponibilidade[];
  initialObservacao: string | null;
};

type DraftSlot = {
  key: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
};

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function DisponibilidadeForm({ initialSlots, initialObservacao }: Props) {
  const [slots, setSlots] = useState<DraftSlot[]>(() =>
    initialSlots.length
      ? initialSlots.map((s) => ({
          key: s.id ?? newKey(),
          dia_semana: s.dia_semana,
          hora_inicio: s.hora_inicio.slice(0, 5),
          hora_fim: s.hora_fim.slice(0, 5),
        }))
      : [{ key: newKey(), dia_semana: 1, hora_inicio: "09:00", hora_fim: "12:00" }],
  );
  const [observacao, setObservacao] = useState(initialObservacao ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  const slotsJson = useMemo(
    () =>
      JSON.stringify(
        slots.map((s) => ({
          dia_semana: s.dia_semana,
          hora_inicio: s.hora_inicio,
          hora_fim: s.hora_fim,
          ativo: true,
        })),
      ),
    [slots],
  );

  function addSlot(dia?: number) {
    setSlots((prev) => [
      ...prev,
      {
        key: newKey(),
        dia_semana: dia ?? 1,
        hora_inicio: "09:00",
        hora_fim: "18:00",
      },
    ]);
  }

  function removeSlot(key: string) {
    setSlots((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.key !== key)));
  }

  async function submitAction(formData: FormData) {
    setMsg(null);
    formData.set("slots_json", slotsJson);
    formData.set("observacao", observacao);
    try {
      await saveMinhaDisponibilidadeAction(formData);
      setMsg("Disponibilidade salva. O SDR verá esses horários na Agenda.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }

  return (
    <form action={submitAction} className="space-y-6">
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Horários livres na semana</h2>
            <p className="text-xs text-zinc-500">
              Informe os períodos em que o SDR pode marcar compromissos com você.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => addSlot()}>
            <Plus className="mr-1 h-4 w-4" />
            Adicionar horário
          </Button>
        </div>

        <div className="space-y-2">
          {slots.map((s) => (
            <div
              key={s.key}
              className="grid grid-cols-1 items-end gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 sm:grid-cols-[1.2fr_1fr_1fr_auto]"
            >
              <div>
                <Label>Dia</Label>
                <select
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  value={s.dia_semana}
                  onChange={(e) =>
                    setSlots((prev) =>
                      prev.map((x) =>
                        x.key === s.key ? { ...x, dia_semana: Number(e.target.value) } : x,
                      ),
                    )
                  }
                >
                  {DIAS_SEMANA.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Início</Label>
                <Input
                  type="time"
                  value={s.hora_inicio}
                  onChange={(e) =>
                    setSlots((prev) =>
                      prev.map((x) => (x.key === s.key ? { ...x, hora_inicio: e.target.value } : x)),
                    )
                  }
                />
              </div>
              <div>
                <Label>Fim</Label>
                <Input
                  type="time"
                  value={s.hora_fim}
                  onChange={(e) =>
                    setSlots((prev) =>
                      prev.map((x) => (x.key === s.key ? { ...x, hora_fim: e.target.value } : x)),
                    )
                  }
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-red-500/40 text-red-300"
                onClick={() => removeSlot(s.key)}
                aria-label="Remover horário"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {DIAS_SEMANA.filter((d) => d.value >= 1 && d.value <= 5).map((d) => (
            <Button key={d.value} type="button" size="sm" variant="outline" onClick={() => addSlot(d.value)}>
              + {d.short}
            </Button>
          ))}
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
      <input type="hidden" name="observacao" value={observacao} />

      {msg ? (
        <p
          className={
            msg.startsWith("Disponibilidade")
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
