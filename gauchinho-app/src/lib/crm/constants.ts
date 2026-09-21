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
  valor_fechado?: number | null;
  valor_credito?: number | null;
  valor_estimado?: number | null;
  valor_simulado?: number | null;
}): number {
  const v = Number(lead.valor_fechado ?? lead.valor_credito ?? lead.valor_estimado ?? lead.valor_simulado ?? 0);
  return Number.isFinite(v) ? v : 0;
}

export function valorParcelaLead(lead: {
  valor_parcela?: number | null;
  valor_parcela_fechamento?: number | null;
  dados_simulacao?: unknown;
  valor_fechado?: number | null;
  valor_estimado?: number | null;
  valor_credito?: number | null;
  valor_simulado?: number | null;
  prazo_simulado?: number | null;
}): number {
  if (lead.valor_parcela != null && Number(lead.valor_parcela) > 0) {
    return Number(lead.valor_parcela);
  }
  if (lead.valor_parcela_fechamento != null && Number(lead.valor_parcela_fechamento) > 0) {
    return Number(lead.valor_parcela_fechamento);
  }
  if (lead.dados_simulacao && typeof lead.dados_simulacao === "object") {
    const ds = lead.dados_simulacao as Record<string, unknown>;
    const res = ds.resultado as Record<string, unknown> | undefined;
    const p1 = res?.parcela ?? res?.valorParcela ?? res?.parcelaReduzida ?? res?.parcelaIntegral;
    if (p1 && Number(p1) > 0) return Number(p1);
    const p2 = ds.parcela ?? ds.valorParcela ?? ds.valor_parcela ?? ds.valor_mensal_disponivel;
    if (p2 && Number(p2) > 0) return Number(p2);
  }
  const credito = Number(lead.valor_fechado ?? lead.valor_credito ?? lead.valor_estimado ?? lead.valor_simulado ?? 0);
  if (credito > 5000) {
    const prazo = Number(lead.prazo_simulado && lead.prazo_simulado > 0 ? lead.prazo_simulado : 160);
    return Math.round(((credito * 1.18) / prazo) * 100) / 100;
  }
  return 0;
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

export const CRM_MACRO_TIERS = [
  {
    id: "nivel-1-topo",
    slug: "topo_funil",
    nivelNumero: 1,
    fase: "topo" as const,
    nomeNivel: "TOPO FUNIL",
    categoria: "VISITANTE & LEAD",
    subtitulo: "Aprendizado e Descoberta",
    conceito: "Entrada de leads, simuladores e eventos",
    corHex: "#7c3aed",
    corGradiente: "from-purple-600 via-indigo-600 to-purple-700",
    icone: "eye" as const,
    etapasSlugs: ["novo_lead", "contato_realizado"] as const,
  },
  {
    id: "nivel-2-meio-sup",
    slug: "meio_superior",
    nivelNumero: 2,
    fase: "meio_sup" as const,
    nomeNivel: "TOPO-MEIO",
    categoria: "LEAD QUALIFICADO",
    subtitulo: "Reconhecimento do Problema",
    conceito: "Validação de perfil, poder de compra e reuniões",
    corHex: "#06b6d4",
    corGradiente: "from-cyan-500 via-teal-500 to-cyan-600",
    icone: "mail" as const,
    etapasSlugs: ["qualificado", "reuniao_agendada", "reuniao_realizada"] as const,
  },
  {
    id: "nivel-3-meio-inf",
    slug: "meio_inferior",
    nivelNumero: 3,
    fase: "meio_inf" as const,
    nomeNivel: "MEIO FUNIL",
    categoria: "OPORTUNIDADE",
    subtitulo: "Consideração da Solução",
    conceito: "Propostas na mesa, lances e cadastros em análise",
    corHex: "#f43f5e",
    corGradiente: "from-rose-500 via-pink-600 to-rose-600",
    icone: "magnet" as const,
    etapasSlugs: ["proposta_enviada", "documentacao_cadastro", "boleto_enviado"] as const,
  },
  {
    id: "nivel-4-fundo",
    slug: "fundo_funil",
    nivelNumero: 4,
    fase: "fundo" as const,
    nomeNivel: "FUNDO FUNIL",
    categoria: "VENDA FECHADA",
    subtitulo: "Decisão de Compra & Contrato",
    conceito: "Cotas ativadas, boletos pagos e conversão",
    corHex: "#f59e0b",
    corGradiente: "from-amber-500 via-emerald-500 to-green-600",
    icone: "handshake" as const,
    etapasSlugs: ["venda_fechada", "pos_venda"] as const,
  },
] as const;

export type CrmMacroFase = (typeof CRM_MACRO_TIERS)[number]["fase"];

export function getMacroTierByFase(faseOrSlug: string | null | undefined) {
  if (!faseOrSlug) return null;
  const f = faseOrSlug.toLowerCase().trim();
  return (
    CRM_MACRO_TIERS.find(
      (t) =>
        t.fase === f ||
        t.slug === f ||
        t.id === f ||
        t.nomeNivel.toLowerCase() === f,
    ) ?? null
  );
}

export function isEtapaInMacroTier(
  etapaSlug: string | null | undefined,
  fase: string | null | undefined,
): boolean {
  if (!etapaSlug || !fase) return false;
  const tier = getMacroTierByFase(fase);
  if (!tier) return false;
  return (tier.etapasSlugs as readonly string[]).includes(etapaSlug);
}

