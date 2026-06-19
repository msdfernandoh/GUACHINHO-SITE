const DEFAULT_TITLE = "GAUCHINHO";
const DEFAULT_SUBTITLE = "Consórcios e soluções financeiras";

/** Mascote estático ao lado do wordmark (quando não há logo upload). */
export const PUBLIC_LOGO_MASCOT_SRC = "/media/gauchinho-sem-fundo.svg";

/**
 * Evita duplicar "Escritório de Soluções Financeiras" no header:
 * título curto (marca) + subtítulo institucional.
 */
export function resolvePublicLogoText(nomeEmpresa?: string | null, subtitulo?: string | null): {
  title: string;
  subtitle: string;
} {
  const rawSub = subtitulo?.trim();
  const rawName = nomeEmpresa?.trim() ?? "";

  if (rawSub) {
    const title = shortenBrandName(rawName) || DEFAULT_TITLE;
    return { title, subtitle: rawSub };
  }

  if (!rawName) {
    return { title: DEFAULT_TITLE, subtitle: DEFAULT_SUBTITLE };
  }

  const lower = rawName.toLowerCase();
  const looksLikeFullLegal =
    lower.includes("escritório") ||
    lower.includes("soluções financeiras") ||
    lower.includes("solucoes financeiras") ||
    rawName.split(/\s+/).length > 2;

  if (looksLikeFullLegal) {
    const first = rawName.split(/\s+/)[0] ?? DEFAULT_TITLE;
    return {
      title: first,
      subtitle: DEFAULT_SUBTITLE,
    };
  }

  return { title: rawName, subtitle: DEFAULT_SUBTITLE };
}

function shortenBrandName(name: string): string {
  const t = name.trim();
  if (!t) return DEFAULT_TITLE;
  if (t.split(/\s+/).length === 1) return t;
  const lower = t.toLowerCase();
  if (lower.includes("escritório") || lower.includes("soluções") || lower.includes("solucoes")) {
    return t.split(/\s+/)[0] ?? DEFAULT_TITLE;
  }
  return t;
}
