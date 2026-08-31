"use client";

import { useId, useState } from "react";
import { Input, Label, surfaceInputDark } from "@/components/ui/form-primitives";

export function AgendaDurationFields({ initialMinutes = 60, initialAllDay = false, initialTime = "10:00" }: {
  initialMinutes?: number; initialAllDay?: boolean; initialTime?: string;
}) {
  const id = useId();
  const [allDay, setAllDay] = useState(initialAllDay);
  return <fieldset className="space-y-3 rounded-lg border border-zinc-700 p-3">
    <legend className="px-1 text-sm text-zinc-300">Horário e duração</legend>
    <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-zinc-100">
      <input name="dia_inteiro" type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4 accent-amber-400" />
      Dia todo
    </label>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div className="col-span-2 sm:col-span-1"><Label htmlFor={`${id}-hora`}>Início</Label>
        <Input id={`${id}-hora`} name="hora" type="time" defaultValue={initialTime} disabled={allDay} required={!allDay} className={surfaceInputDark} /></div>
      <div><Label htmlFor={`${id}-horas`}>Horas</Label>
        <Input id={`${id}-horas`} name="duracao_horas" type="number" min={0} max={168} step={1} defaultValue={initialAllDay ? 1 : Math.floor(initialMinutes / 60)} disabled={allDay} required={!allDay} className={surfaceInputDark} /></div>
      <div><Label htmlFor={`${id}-minutos`}>Minutos</Label>
        <Input id={`${id}-minutos`} name="duracao_minutos_restantes" type="number" min={0} max={59} step={1} defaultValue={initialAllDay ? 0 : initialMinutes % 60} disabled={allDay} required={!allDay} className={surfaceInputDark} /></div>
    </div>
    <p className="text-xs text-zinc-400">{allDay ? "Reserva o dia inteiro, sem horário específico no Google." : "Exemplo: 1 hora e 30 minutos. Horários no fuso de Cuiabá (UTC−4)."}</p>
  </fieldset>;
}
