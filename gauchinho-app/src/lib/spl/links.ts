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

/** O token do painel tem 32 caracteres e fica no fim do link (ele pode conter "-"). */
export const TOKEN_PAINEL_TAMANHO = 32;

export function extrairToken(segmento: string): string {
  const s = decodeURIComponent(segmento ?? "");
  return s.length > TOKEN_PAINEL_TAMANHO ? s.slice(-TOKEN_PAINEL_TAMANHO) : s;
}

/** Códigos de convite e de vendedor não têm "-": vale o que vem depois do último. */
export function extrairCodigo(segmento: string): string {
  const s = decodeURIComponent(segmento ?? "");
  return s.slice(s.lastIndexOf("-") + 1);
}

export const caminhoPainel = (nome: string, token: string) => `/spl/painel/${slugNome(nome)}-${token}`;
export const caminhoConvite = (nome: string, codigo: string) => `/spl/e/${slugNome(nome)}-${codigo}`;
export const caminhoPortfolio = (nome: string, codigo: string) => `/spl/v/${slugNome(nome)}-${codigo}`;
