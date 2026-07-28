export const DIAS_SEMANA = [
  { value: 1, label: "Segunda", short: "Seg" },
  { value: 2, label: "Terça", short: "Ter" },
  { value: 3, label: "Quarta", short: "Qua" },
  { value: 4, label: "Quinta", short: "Qui" },
  { value: 5, label: "Sexta", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
  { value: 0, label: "Domingo", short: "Dom" },
] as const;

export type SlotDisponibilidade = {
  id?: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  ativo: boolean;
};

export type DisponibilidadeConsultor = {
  usuarioId: string;
  nome: string;
  observacao: string | null;
  slots: SlotDisponibilidade[];
};

function timeLabel(t: string): string {
  const s = t.slice(0, 5);
  return s;
}

/** Agrupa slots em texto legível para o SDR. */
export function formatDisponibilidadeResumo(
  slots: SlotDisponibilidade[],
  observacao?: string | null,
): string {
  const ativos = slots.filter((s) => s.ativo);
  if (!ativos.length) {
    return observacao?.trim() || "Sem horários cadastrados";
  }
  const byDay = new Map<number, string[]>();
  for (const s of ativos) {
    const list = byDay.get(s.dia_semana) ?? [];
    list.push(`${timeLabel(s.hora_inicio)}–${timeLabel(s.hora_fim)}`);
    byDay.set(s.dia_semana, list);
  }
  const parts = DIAS_SEMANA.filter((d) => byDay.has(d.value)).map((d) => {
    return `${d.short} ${byDay.get(d.value)!.join(", ")}`;
  });
  const base = parts.join(" · ");
  if (observacao?.trim()) return `${base} — ${observacao.trim()}`;
  return base;
}
