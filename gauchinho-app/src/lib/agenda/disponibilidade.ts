export const DIAS_SEMANA = [
  { value: 1, label: "Segunda", short: "Seg" },
  { value: 2, label: "Terça", short: "Ter" },
  { value: 3, label: "Quarta", short: "Qua" },
  { value: 4, label: "Quinta", short: "Qui" },
  { value: 5, label: "Sexta", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
  { value: 0, label: "Domingo", short: "Dom" },
] as const;

export const MODALIDADES_ATENDIMENTO = [
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "Online" },
  { value: "ambos", label: "Presencial ou online" },
] as const;

export type ModalidadeAtendimento = (typeof MODALIDADES_ATENDIMENTO)[number]["value"];
export type ModalidadeCompromisso = "presencial" | "online";

export type SlotDisponibilidade = {
  id?: string;
  /** Recorrência semanal (0=dom … 6=sáb). Null quando for data específica. */
  dia_semana: number | null;
  /** YYYY-MM-DD — data específica. Null quando for recorrência semanal. */
  data_especifica: string | null;
  hora_inicio: string;
  hora_fim: string;
  ativo: boolean;
  modalidade_atendimento: ModalidadeAtendimento;
};

export type BloqueioAgenda = {
  id?: string;
  data_inicio: string;
  data_fim: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  motivo: string;
};

export type DisponibilidadeConsultor = {
  usuarioId: string;
  nome: string;
  observacao: string | null;
  modalidadePadrao: ModalidadeAtendimento;
  slots: SlotDisponibilidade[];
  bloqueios: BloqueioAgenda[];
};

function timeLabel(t: string): string {
  return t.slice(0, 5);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toDateIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Gera todas as datas do dia da semana entre start (inclusive) e endMonthOffset months ahead. */
export function gerarDatasDiaSemana(opts: {
  diaSemana: number;
  mesesAFrente: number;
  aPartirDe?: Date;
}): string[] {
  const start = opts.aPartirDe ? new Date(opts.aPartirDe) : new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth() + opts.mesesAFrente + 1, 0);
  const out: string[] = [];
  const cursor = new Date(start);
  while (cursor.getDay() !== opts.diaSemana) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor > end) return out;
  }
  while (cursor <= end) {
    out.push(toDateIso(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return out;
}

export function formatModalidade(m: ModalidadeAtendimento | null | undefined): string {
  if (m === "presencial") return "Presencial";
  if (m === "online") return "Online";
  return "Presencial/Online";
}

/** Agrupa slots em texto legível para o SDR. */
export function formatDisponibilidadeResumo(
  slots: SlotDisponibilidade[],
  observacao?: string | null,
  bloqueios?: BloqueioAgenda[],
  modalidadePadrao?: ModalidadeAtendimento | null,
): string {
  const ativos = slots.filter((s) => s.ativo);
  const parts: string[] = [];

  if (modalidadePadrao && modalidadePadrao !== "ambos") {
    parts.push(formatModalidade(modalidadePadrao));
  }

  const semanais = ativos.filter((s) => s.data_especifica == null && s.dia_semana != null);
  const byDay = new Map<number, string[]>();
  for (const s of semanais) {
    const d = s.dia_semana!;
    const list = byDay.get(d) ?? [];
    list.push(`${timeLabel(s.hora_inicio)}–${timeLabel(s.hora_fim)}`);
    byDay.set(d, list);
  }
  const weekParts = DIAS_SEMANA.filter((d) => byDay.has(d.value)).map((d) => {
    return `${d.short} ${byDay.get(d.value)!.join(", ")}`;
  });
  if (weekParts.length) parts.push(weekParts.join(" · "));

  const hoje = toDateIso(new Date());
  const especificas = ativos
    .filter((s) => s.data_especifica && s.data_especifica >= hoje)
    .sort((a, b) => String(a.data_especifica).localeCompare(String(b.data_especifica)));
  if (especificas.length) {
    const sample = especificas.slice(0, 4).map((s) => {
      const [y, m, d] = String(s.data_especifica).split("-");
      return `${d}/${m} ${timeLabel(s.hora_inicio)}–${timeLabel(s.hora_fim)}`;
    });
    const extra = especificas.length > 4 ? ` (+${especificas.length - 4})` : "";
    parts.push(`Datas: ${sample.join(", ")}${extra}`);
  }

  const bloqueiosAtivos = (bloqueios ?? []).filter((b) => b.data_fim >= hoje);
  if (bloqueiosAtivos.length) {
    parts.push(
      `Bloqueios: ${bloqueiosAtivos
        .slice(0, 2)
        .map((b) => {
          const ini = b.data_inicio.split("-").reverse().slice(0, 2).join("/");
          const fim = b.data_fim.split("-").reverse().slice(0, 2).join("/");
          return ini === fim ? `${ini} (${b.motivo})` : `${ini}–${fim} (${b.motivo})`;
        })
        .join("; ")}`,
    );
  }

  if (!parts.length) {
    return observacao?.trim() || "Sem horários cadastrados";
  }
  const base = parts.join(" · ");
  if (observacao?.trim()) return `${base} — ${observacao.trim()}`;
  return base;
}

export function isDataBloqueada(
  dataIso: string,
  bloqueios: BloqueioAgenda[],
): BloqueioAgenda | null {
  for (const b of bloqueios) {
    if (dataIso >= b.data_inicio && dataIso <= b.data_fim) return b;
  }
  return null;
}
