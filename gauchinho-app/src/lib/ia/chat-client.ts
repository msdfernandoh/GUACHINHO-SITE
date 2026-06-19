export type IaQuickAction = {
  id: string;
  label: string;
  message?: string;
  href?: string;
  evento: string;
};

export const IA_QUICK_ACTIONS: IaQuickAction[] = [
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
    id: "cartas",
    label: "Cartas contempladas",
    message: "Quero saber sobre cartas contempladas.",
    href: "/cartas-contempladas",
    evento: "ia_cta_cartas",
  },
  {
    id: "imoveis",
    label: "Oportunidades imobiliárias",
    message: "Quero ver oportunidades imobiliárias.",
    href: "/oportunidades-imobiliarias",
    evento: "ia_cta_imoveis",
  },
  {
    id: "calculadoras",
    label: "Calculadoras",
    message: "Quero usar as calculadoras financeiras.",
    href: "/calculadoras",
    evento: "ia_cta_calculadoras",
  },
  {
    id: "faq",
    label: "Perguntas frequentes",
    message: "Quero ler o FAQ sobre consórcio e financiamento.",
    href: "/perguntas-frequentes",
    evento: "ia_cta_faq",
  },
  {
    id: "dicas",
    label: "Dicas do Tchê",
    message: "Quero ver as Dicas do Tchê.",
    href: "/dicas-do-tche",
    evento: "ia_cta_dicas",
  },
  {
    id: "casos",
    label: "Depoimentos e casos",
    message: "Quero ver depoimentos e histórias de clientes no site.",
    href: "/depoimentos",
    evento: "ia_cta_casos",
  },
  {
    id: "especialista",
    label: "Falar com especialista",
    message: "Quero falar com um especialista.",
    evento: "ia_cta_whatsapp",
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
