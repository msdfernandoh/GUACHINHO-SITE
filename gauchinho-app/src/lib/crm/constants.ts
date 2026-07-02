export const FUNNEL_STATUSES = [
  "Novo",
  "Em atendimento",
  "Tentativa de contato",
  "Qualificado",
  "Simulação enviada",
  "Proposta enviada",
  "Negociação",
  "Fechado",
  "Perdido",
  "Sem resposta",
  "Arquivado",
] as const;

export type FunnelStatus = (typeof FUNNEL_STATUSES)[number];

/** Colunas do Kanban (subset operacional). */
export const KANBAN_STATUSES = [
  "Novo",
  "Em atendimento",
  "Qualificado",
  "Simulação enviada",
  "Proposta enviada",
  "Negociação",
  "Fechado",
  "Perdido",
] as const;

export const LEAD_TEMPERATURES = ["Frio", "Morno", "Quente", "Muito quente"] as const;

export type LeadTemperature = (typeof LEAD_TEMPERATURES)[number];

export const MOTIVOS_PERDA = [
  "Sem resposta",
  "Sem interesse",
  "Valor incompatível",
  "Comprou com outro",
  "Prazo não atende",
  "Não tem entrada/lance",
  "Não aprovado",
  "Preferiu esperar",
  "Dados inválidos",
  "Outro",
] as const;

export const ATIVIDADE_TIPOS = [
  "Ligação",
  "WhatsApp",
  "E-mail",
  "Reunião",
  "Simulação",
  "Proposta",
  "Retorno",
  "Observação",
  "Tarefa",
] as const;

export const ATIVIDADE_STATUS = ["pendente", "concluida", "cancelada", "vencida"] as const;

export const ORIGENS_LABEL: Record<string, string> = {
  simulador_consorcio: "Simulador consórcio",
  simulador_financiamento: "Simulador financiamento",
  grupos: "Grupos",
  carta_contemplada: "Cartas contempladas",
  oportunidade_imobiliaria: "Oportunidades imobiliárias",
  calculadora_financeira: "Calculadoras",
  ia_chat: "IA / chat",
  conteudo: "Conteúdo",
  home: "Home",
  manual: "Manual",
  whatsapp: "WhatsApp",
  evento: "Evento",
};

export function labelOrigem(origem: string | null | undefined): string {
  if (!origem) return "—";
  return ORIGENS_LABEL[origem] ?? origem;
}

export function valorEstimadoLead(lead: {
  valor_estimado?: number | null;
  valor_simulado?: number | null;
}): number {
  const v = Number(lead.valor_estimado ?? lead.valor_simulado ?? 0);
  return Number.isFinite(v) ? v : 0;
}
