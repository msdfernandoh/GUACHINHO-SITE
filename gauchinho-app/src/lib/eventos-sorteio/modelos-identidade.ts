/**
 * Modelos de Identidade Visual pré-aprovados e utilitários de normalização para o módulo de eventos.
 * Reutiliza os assets e paletas oficiais existentes no repositório (Racon e Gauchinho).
 */

export type ModeloIdentidadeVisual = {
  id: "racon" | "gauchinho";
  nome: string;
  logoUrl: string;
  corPrimaria: string;
  corSecundaria: string;
  corDestaque: string;
  descricao: string;
};

export const MODELOS_IDENTIDADE_EVENTO: Record<"racon" | "gauchinho", ModeloIdentidadeVisual> = {
  racon: {
    id: "racon",
    nome: "Racon Consórcios",
    logoUrl: "/racon/logoracon.jpg",
    corPrimaria: "#0066cc",
    corSecundaria: "#0c2340",
    corDestaque: "#0099dd",
    descricao: "Azul Royal e Marinho oficial Racon, ideal para encontros de negócios e franquias.",
  },
  gauchinho: {
    id: "gauchinho",
    nome: "Gauchinho Consórcios",
    logoUrl: "/media/gauchinho-logo.png",
    corPrimaria: "#c9a84c",
    corSecundaria: "#0a1628",
    corDestaque: "#c9a84c",
    descricao: "Dourado e Azul Marinho oficial Gauchinho, para eventos institucionais e feirões.",
  },
};

/**
 * Normaliza o prefixo do número da sorte.
 * Ex: 'ING' -> 'ING-'
 *     'rcn-' -> 'RCN-'
 *     '  gch  ' -> 'GCH-'
 *     '' -> ''
 */
export function normalizarPrefixoSorteio(raw: string | null | undefined): string {
  if (!raw) return "";
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (!cleaned) return "";
  // Se já termina em hífen, remove duplicados finais e garante apenas um hífen
  const withoutTrailingHyphens = cleaned.replace(/-+$/, "");
  if (!withoutTrailingHyphens) return "";
  return `${withoutTrailingHyphens}-`;
}

/**
 * Gera exemplo amigável para exibição ao vivo na interface de edição.
 * Ex: 'ING-' ou 'ING' -> 'ING-001'
 *     '' -> '001'
 */
export function formatarExemploPrefixo(rawPrefixo: string | null | undefined, sequencia = 1): string {
  const norm = normalizarPrefixoSorteio(rawPrefixo);
  const pad = String(sequencia).padStart(3, "0");
  return norm ? `${norm}${pad}` : pad;
}

/**
 * Detecta qual modelo de identidade está ativo com base nos campos salvos no evento.
 */
export function detectarModeloAtivo(
  logoUrl?: string | null,
  corPrimaria?: string | null,
): "racon" | "gauchinho" | "personalizado" | null {
  const logo = (logoUrl ?? "").trim().toLowerCase();
  const prim = (corPrimaria ?? "").trim().toLowerCase();

  if (logo.includes("racon") || prim === "#0066cc") {
    return "racon";
  }
  if (logo.includes("gauchinho") || prim === "#c9a84c" || prim === "#0a1628" || prim === "#d97706") {
    return "gauchinho";
  }
  if (logo || prim) {
    return "personalizado";
  }
  return null;
}
