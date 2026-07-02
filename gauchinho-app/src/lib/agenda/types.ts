export const AGENDA_TIPOS = [
  "Atendimento",
  "Visita",
  "Ligação",
  "WhatsApp",
  "Reunião",
  "Consultoria",
  "Retorno",
  "Outro",
] as const;

export type AgendaTipo = (typeof AGENDA_TIPOS)[number];

export const AGENDA_STATUS = [
  "agendado",
  "concluido",
  "remarcado",
  "cancelado",
  "nao_compareceu",
] as const;

export type AgendaStatus = (typeof AGENDA_STATUS)[number];

export const AGENDA_RESULTADOS = [
  "Voltar a falar em data futura",
  "Fechou",
  "Sem interesse",
  "Sem resposta",
  "Em negociação",
] as const;

export type AgendaResultado = (typeof AGENDA_RESULTADOS)[number];

export type AgendaCompromissoRow = {
  id: string;
  lead_id: string | null;
  consultor_id: string | null;
  titulo: string;
  descricao: string | null;
  tipo: string;
  data_inicio: string;
  data_fim: string | null;
  duracao_minutos: number | null;
  local: string | null;
  status: AgendaStatus;
  resultado: string | null;
  observacao_resultado: string | null;
  proxima_data: string | null;
  created_at: string;
  updated_at: string;
  leads?: { nome: string; whatsapp: string | null } | null;
  usuarios?: { nome: string } | null;
};
