export const CRM_12_ETAPAS = [
  { slug: "novo_lead", nome: "Novo lead", ordem: 1, cor: "#3b82f6" },
  { slug: "contato_realizado", nome: "Contato realizado", ordem: 2, cor: "#06b6d4" },
  { slug: "qualificado", nome: "Qualificado", ordem: 3, cor: "#8b5cf6" },
  { slug: "reuniao_agendada", nome: "Reunião agendada", ordem: 4, cor: "#ec4899" },
  { slug: "reuniao_realizada", nome: "Reunião realizada", ordem: 5, cor: "#f59e0b" },
  { slug: "proposta_enviada", nome: "Proposta enviada", ordem: 6, cor: "#eab308" },
  { slug: "documentacao_cadastro", nome: "Documentação / cadastro", ordem: 7, cor: "#10b981" },
  { slug: "boleto_enviado", nome: "Boleto enviado", ordem: 8, cor: "#14b8a6" },
  { slug: "venda_fechada", nome: "Venda fechada", ordem: 9, cor: "#22c55e", isWon: true },
  { slug: "pos_venda", nome: "Pós-venda / acompanhamento", ordem: 10, cor: "#64748b" },
  { slug: "perdido", nome: "Perdido", ordem: 11, cor: "#ef4444", isLost: true },
  { slug: "standby_futuro", nome: "Stand-by / futuro", ordem: 12, cor: "#a855f7", isStandby: true },
] as const;

export type CrmEtapaSlug = (typeof CRM_12_ETAPAS)[number]["slug"];

export const MODELOS_INTERESSE = [
  { codigo: "CLIENTE_FINAL", label: "Cliente Final" },
  { codigo: "MICROFRANQUEADO", label: "Microfranqueado" },
  { codigo: "GERADOR_NEGOCIOS", label: "Gerador de Negócios" },
  { codigo: "GERADOR_POSSIBILIDADES", label: "Gerador de Possibilidades" },
  { codigo: "NAO_DEFINIDO", label: "Ainda não definido" },
] as const;

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

/** Colunas legadas do Kanban (compatibilidade). */
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

export const LEAD_TEMPERATURES = ["Frio", "Morno", "Quente", "Muito quente", "Urgente"] as const;

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
  indicacao: "Indicação",
  evento_sorteio: "Evento / sorteio",
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

export function mapLegacyStatusToEtapaSlug(status: string | null | undefined): string {
  if (!status) return "novo_lead";
  const s = status.trim().toLowerCase();

  if (s === "novo" || s === "novo lead" || s === "novo_lead") return "novo_lead";
  if (s === "em atendimento" || s === "contato realizado" || s === "contato_realizado" || s === "contato")
    return "contato_realizado";
  if (s === "qualificado") return "qualificado";
  if (s === "reunião agendada" || s === "reuniao agendada" || s === "reuniao_agendada") return "reuniao_agendada";
  if (s === "reunião realizada" || s === "reuniao realizada" || s === "reuniao_realizada") return "reuniao_realizada";
  if (
    s === "proposta enviada" ||
    s === "proposta_enviada" ||
    s === "proposta" ||
    s === "negociação" ||
    s === "negociacao"
  )
    return "proposta_enviada";
  if (
    s === "documentação / cadastro" ||
    s === "documentacao / cadastro" ||
    s === "documentacao_cadastro" ||
    s === "documentação" ||
    s === "documentacao" ||
    s === "cadastro"
  )
    return "documentacao_cadastro";
  if (s === "boleto enviado" || s === "boleto_enviado" || s === "boleto") return "boleto_enviado";
  if (s === "venda fechada" || s === "venda_fechada" || s === "ganho" || s === "fechado" || s === "convertido")
    return "venda_fechada";
  if (s === "pós-venda" || s === "pos-venda" || s === "pos_venda" || s === "pos venda") return "pos_venda";
  if (s === "perdido") return "perdido";
  if (
    s === "stand-by / futuro" ||
    s === "standby / futuro" ||
    s === "standby_futuro" ||
    s === "standby" ||
    s === "futuro"
  )
    return "standby_futuro";

  return "novo_lead";
}

