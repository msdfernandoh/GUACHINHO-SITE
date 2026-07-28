"use client";

import { useMemo, useState } from "react";
import type { DisponibilidadeConsultor } from "@/lib/agenda/disponibilidade";
import {
  formatDisponibilidadeResumo,
  isDataBloqueada,
  type ModalidadeCompromisso,
} from "@/lib/agenda/disponibilidade";

type Props = {
  consultores: DisponibilidadeConsultor[];
  selectedId: string;
  onSelect: (id: string) => void;
  dataSelecionada?: string;
  name?: string;
  className?: string;
  /** Quando true, inclui select de presencial/online no formulário. */
  showModalidade?: boolean;
};

export function ConsultorDisponibilidadeSelect({
  consultores,
  selectedId,
  onSelect,
  dataSelecionada,
  name = "consultor_id",
  className,
  showModalidade = true,
}: Props) {
  const selected = useMemo(
    () => consultores.find((c) => c.usuarioId === selectedId) ?? null,
    [consultores, selectedId],
  );
  const resumo = selected
    ? formatDisponibilidadeResumo(
        selected.slots,
        selected.observacao,
        selected.bloqueios,
        selected.modalidadePadrao,
      )
    : null;

  const bloqueio =
    selected && dataSelecionada
      ? isDataBloqueada(dataSelecionada, selected.bloqueios)
      : null;

  const [modalidade, setModalidade] = useState<ModalidadeCompromisso>(() => {
    if (selected?.modalidadePadrao === "online") return "online";
    return "presencial";
  });

  return (
    <div className={className}>
      <select
        name={name}
        required
        value={selectedId}
        onChange={(e) => {
          const id = e.target.value;
          onSelect(id);
          const c = consultores.find((x) => x.usuarioId === id);
          if (c?.modalidadePadrao === "online") setModalidade("online");
          else if (c?.modalidadePadrao === "presencial") setModalidade("presencial");
        }}
        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
      >
        {consultores.map((c) => (
          <option key={c.usuarioId} value={c.usuarioId}>
            {c.nome}
            {c.slots.some((s) => s.ativo) ? "" : " (sem horários)"}
          </option>
        ))}
      </select>

      {showModalidade ? (
        <div className="mt-2">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">Tipo de atendimento</p>
          <div className="flex gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-200">
              <input
                type="radio"
                name="modalidade_atendimento"
                value="presencial"
                checked={modalidade === "presencial"}
                onChange={() => setModalidade("presencial")}
              />
              Presencial
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-200">
              <input
                type="radio"
                name="modalidade_atendimento"
                value="online"
                checked={modalidade === "online"}
                onChange={() => setModalidade("online")}
              />
              Online
            </label>
          </div>
        </div>
      ) : null}

      {bloqueio ? (
        <p className="mt-1.5 text-xs leading-snug text-red-300">
          <span className="font-medium">Agenda fechada neste dia:</span> {bloqueio.motivo}
          {bloqueio.data_inicio !== bloqueio.data_fim
            ? ` (${bloqueio.data_inicio} a ${bloqueio.data_fim})`
            : ""}
        </p>
      ) : null}

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
