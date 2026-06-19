import type { LeadAtividade, TimelineItem } from "./types";

type HistoricoRow = {
  id: string;
  created_at: string;
  acao: string;
  descricao: string | null;
  status_anterior?: string | null;
  status_novo?: string | null;
};

type EventoRow = {
  id: string;
  created_at: string;
  tipo_evento: string;
  origem: string | null;
  dados_evento?: Record<string, unknown> | null;
};

export function buildLeadTimeline(args: {
  historico: HistoricoRow[];
  eventos: EventoRow[];
  atividades: LeadAtividade[];
  leadCreatedAt: string;
  leadOrigem?: string | null;
}): TimelineItem[] {
  const items: TimelineItem[] = [
    {
      id: "lead-created",
      at: args.leadCreatedAt,
      tipo: "lead_criado",
      titulo: "Lead criado",
      descricao: args.leadOrigem ? `Origem: ${args.leadOrigem}` : undefined,
      origem: "historico",
    },
  ];

  for (const h of args.historico) {
    items.push({
      id: `h-${h.id}`,
      at: h.created_at,
      tipo: h.acao,
      titulo: h.acao.replace(/_/g, " "),
      descricao:
        h.descricao ??
        (h.status_anterior && h.status_novo
          ? `${h.status_anterior} → ${h.status_novo}`
          : null),
      origem: "historico",
    });
  }

  for (const e of args.eventos) {
    items.push({
      id: `e-${e.id}`,
      at: e.created_at,
      tipo: e.tipo_evento,
      titulo: e.tipo_evento.replace(/_/g, " "),
      descricao: e.origem ?? undefined,
      origem: "evento",
    });
  }

  for (const a of args.atividades) {
    items.push({
      id: `a-${a.id}`,
      at: a.data_conclusao ?? a.data_agendada ?? a.created_at,
      tipo: a.status === "concluida" ? "lead_followup_concluido" : "lead_followup_criado",
      titulo: `${a.tipo}${a.titulo ? `: ${a.titulo}` : ""}`,
      descricao: a.descricao,
      origem: "atividade",
    });
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return items;
}
