"use client";

import { useMemo, useState } from "react";
import type { DisponibilidadeConsultor } from "@/lib/agenda/disponibilidade";
import { formatDisponibilidadeResumo } from "@/lib/agenda/disponibilidade";

type Props = {
  consultores: DisponibilidadeConsultor[];
  selectedId: string;
  onSelect: (id: string) => void;
  name?: string;
  className?: string;
};

export function ConsultorDisponibilidadeSelect({
  consultores,
  selectedId,
  onSelect,
  name = "consultor_id",
  className,
}: Props) {
  const selected = useMemo(
    () => consultores.find((c) => c.usuarioId === selectedId) ?? null,
    [consultores, selectedId],
  );
  const resumo = selected
    ? formatDisponibilidadeResumo(selected.slots, selected.observacao)
    : null;

  return (
    <div className={className}>
      <select
        name={name}
        required
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
      >
        {consultores.map((c) => (
          <option key={c.usuarioId} value={c.usuarioId}>
            {c.nome}
            {c.slots.some((s) => s.ativo) ? "" : " (sem horários)"}
          </option>
        ))}
      </select>
      {resumo ? (
        <p className="mt-1.5 text-xs leading-snug text-amber-200/90">
          <span className="font-medium text-amber-300">Disponível:</span> {resumo}
        </p>
      ) : null}
    </div>
  );
}

export function useConsultorDisponibilidade(defaultId: string) {
  const [selectedId, setSelectedId] = useState(defaultId);
  return { selectedId, setSelectedId };
}
