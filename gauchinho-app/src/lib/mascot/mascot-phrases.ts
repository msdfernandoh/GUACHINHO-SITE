export const MASCOT_SESSION_HIDDEN_KEY = "gauchinho-mascot-hidden";
export const MASCOT_SESSION_PHRASE_PREFIX = "gauchinho-mascot-phrase";

export type MascotContextKey =
  | "home"
  | "simulador"
  | "simulador_imovel"
  | "simulador_veiculo"
  | "grupos"
  | "contempladas"
  | "imoveis"
  | "eventos"
  | "calculadoras"
  | "seguradoras"
  | "login"
  | "proposta"
  | "default";

export const MASCOT_PHRASES: Record<MascotContextKey, readonly string[]> = {
  home: [
    "Buenas! Vamos planejar seu próximo sonho?",
    "O primeiro passo para conquistar começa aqui.",
    "Seu futuro merece uma boa estratégia.",
  ],
  simulador: [
    "Simule agora e veja qual caminho combina com você.",
    "Consórcio ou financiamento? Eu te ajudo a comparar.",
    "Planejar bem é o segredo para pagar melhor.",
  ],
  simulador_imovel: [
    "Realize o sonho da casa própria! 🏠",
    "A casa própria pode estar mais perto do que parece.",
    "Vamos transformar aluguel em patrimônio?",
    "Escolha o crédito e planeje sua conquista.",
  ],
  simulador_veiculo: [
    "Seu próximo carro pode começar com uma boa simulação.",
    "Bora tirar esse projeto da garagem?",
  ],
  grupos: [
    "Escolha o grupo certo e planeje sua contemplação.",
    "Aqui você compara oportunidades de verdade.",
    "Grupo bom é aquele que cabe no seu plano.",
  ],
  contempladas: [
    "Contemplação é quando o planejamento vira conquista.",
    "Veja oportunidades prontas para acelerar seu sonho.",
  ],
  imoveis: [
    "Seu imóvel ideal pode estar nessa página.",
    "Olhe com calma: patrimônio se escolhe com estratégia.",
  ],
  eventos: [
    "Vem aprender a transformar renda em patrimônio.",
    "Um bom negócio começa com uma boa conversa.",
    "Eventos para quem quer aprender e realizar.",
  ],
  calculadoras: [
    "Coloque os números na mesa antes de decidir.",
    "Conta bem feita evita aperto depois, tchê!",
    "Vamos comparar os caminhos antes de decidir?",
  ],
  seguradoras: [
    "Proteção também faz parte do planejamento.",
    "Cuidar do patrimônio é tão importante quanto conquistar.",
  ],
  login: ["Área dos especialistas. Entre e bora trabalhar!"],
  proposta: [
    "Sua simulação já mostra um caminho possível.",
    "Agora é hora de analisar com estratégia.",
  ],
  default: ["Buenas, tchê! Conte comigo nessa jornada."],
};

const IMOVEL_TIPOS = new Set(["imovel", "imóvel"]);
const VEICULO_TIPOS = new Set([
  "automovel",
  "automóvel",
  "veiculo",
  "veículo",
  "moto",
  "caminhao",
  "caminhão",
  "maquinario",
  "maquinário",
  "frota",
]);

export function resolveMascotContext(pathname: string, search = ""): MascotContextKey {
  const path = pathname.replace(/\/$/, "") || "/";
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  if (path === "/") return "home";
  if (path === "/login") return "login";

  if (path.startsWith("/simulador")) {
    const tipo = (params.get("tipo") ?? "").toLowerCase();
    if (IMOVEL_TIPOS.has(tipo)) return "simulador_imovel";
    if (VEICULO_TIPOS.has(tipo)) return "simulador_veiculo";
    return "simulador";
  }

  if (path.startsWith("/calculadoras")) return "calculadoras";
  if (path.startsWith("/grupos")) return "grupos";
  if (path.startsWith("/cartas-contempladas")) return "contempladas";
  if (path.startsWith("/oportunidades-imobiliarias")) return "imoveis";
  if (path.startsWith("/eventos")) return "eventos";
  if (path.startsWith("/seguradoras")) return "seguradoras";

  if (path.includes("/propostas") || path.includes("/proposta")) return "proposta";

  return "default";
}

export function pickMascotPhrase(context: MascotContextKey, sessionKey: string): string {
  const options = MASCOT_PHRASES[context] ?? MASCOT_PHRASES.default;
  if (typeof window === "undefined") return options[0] ?? "";

  const stored = sessionStorage.getItem(sessionKey);
  if (stored && options.includes(stored)) return stored;

  const idx = Math.floor(Math.random() * options.length);
  const phrase = options[idx] ?? options[0] ?? "";
  sessionStorage.setItem(sessionKey, phrase);
  return phrase;
}
