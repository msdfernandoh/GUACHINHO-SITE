/** "Imobiliária Teste" → "imobiliaria-teste" */
export function slugNome(nome: string): string {
  return (
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "imobiliaria"
  );
}

// Os pré-cadastros do evento usam 64 caracteres hexadecimais; o cadastro usa base64url de 32.
export function extrairToken(segmento: string): string {
  try {
    const valor = decodeURIComponent(segmento);
    return /^(?:[a-z0-9-]+-)?([a-fA-F0-9]{64}|[A-Za-z0-9_-]{32})$/.exec(valor)?.[1] ?? "";
  } catch {
    return "";
  }
}

/** Códigos de convite e de vendedor não têm "-": vale o que vem depois do último. */
export function extrairCodigo(segmento: string): string {
  const s = decodeURIComponent(segmento ?? "");
  return s.slice(s.lastIndexOf("-") + 1);
}

export const caminhoPainel = (nome: string, token: string) => `/spl/painel/${slugNome(nome)}-${token}`;
export const caminhoConvite = (nome: string, codigo: string) => `/spl/e/${slugNome(nome)}-${codigo}`;
export const caminhoPortfolio = (nome: string, codigo: string) => `/spl/v/${slugNome(nome)}-${codigo}`;
