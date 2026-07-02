export type IaQuickAction = {
  id: string;
  label: string;
  message?: string;
  href?: string;
  evento: string;
};

export const IA_QUICK_ACTIONS: IaQuickAction[] = [
  {
    id: "quanto_credito",
    label: "Quanto consigo de crédito?",
    message: "Quanto consigo de crédito?",
    evento: "ia_cta_quanto_credito",
  },
  {
    id: "simulador",
    label: "Simular consórcio",
    message: "Quero simular um consórcio.",
    href: "/simulador?solucao=consorcio&tipo=imovel",
    evento: "ia_cta_simulador",
  },
  {
    id: "financiamento",
    label: "Comparar financiamento",
    message: "Quero comparar financiamento.",
    href: "/simulador?solucao=financiamento&tipo=imovel",
    evento: "ia_cta_simulador",
  },
  {
    id: "grupos",
    label: "Ver grupos disponíveis",
    message: "Quero ver grupos de consórcio disponíveis.",
    href: "/grupos",
    evento: "ia_cta_grupos",
  },
  {
    id: "eventos",
    label: "Ver eventos",
    message: "Quero ver eventos.",
    href: "/eventos",
    evento: "ia_cta_eventos",
  },
  {
    id: "calculadoras",
    label: "Calculadoras",
    message: "Quero usar as calculadoras financeiras.",
    href: "/calculadoras",
    evento: "ia_cta_calculadoras",
  },
  {
    id: "especialista",
    label: "Falar com especialista",
    message: "Quero falar com um especialista.",
    evento: "ia_cta_whatsapp",
  },
  {
    id: "indicar",
    label: "Indicar alguém",
    message: "Quero indicar alguém.",
    href: "/indicar",
    evento: "ia_cta_indicar",
  },
];

export const IA_SESSION_KEY = "gauchinho_ia_session_id";

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(IA_SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(IA_SESSION_KEY, id);
  }
  return id;
}

export function buildWhatsappPosLead(
  nome: string,
  tipoInteresse: string,
  destino: string,
): string {
  const n = nome.trim() || "cliente";
  const interesse = tipoInteresse.trim() || "minha solicitação";
  const text = `Olá, conversei com o assistente do site Gauchinho Escritório de Soluções Financeiras. Meu nome é ${n} e gostaria de continuar o atendimento sobre ${interesse}.`;
  return `https://wa.me/${destino.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
