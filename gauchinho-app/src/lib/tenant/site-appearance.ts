/** Configuração visual do modelo; não altera dados, cálculos ou permissões. */
export const RACON_LOGO = "/racon/logoracon.jpg";
export const VISUAL_COLORS = {
  cor_fundo: "Fundo", cor_titulo: "Títulos", cor_texto: "Textos",
  cor_destaque: "Destaques", cor_botao: "Botões / seleção", cor_texto_botao: "Texto dos botões",
} as const;
export type VisualColor = keyof typeof VISUAL_COLORS;
export type VisualBlockConfig = Partial<Record<VisualColor, string>> & {
  imagem_url?: string;
  imagem_ajuste?: "cover" | "contain";
  imagem_posicao?: "center" | "top" | "bottom" | "left" | "right" | "top-left" | "top-right";
};
export type SitePagesAppearance = Record<string, Record<string, VisualBlockConfig>>;
export type SiteVisualIdentity = { paginas_blocos?: SitePagesAppearance; cor_primaria?: string; cor_fundo?: string; cor_texto?: string; cor_destaque?: string };
export function visualDefaults(identity: SiteVisualIdentity) {
  return {
    "--visual-bg": identity.cor_fundo || "#ffffff",
    "--visual-title": identity.cor_texto || "#0f172a",
    "--visual-text": identity.cor_texto || "#334155",
    "--visual-button": identity.cor_primaria || "#0066cc",
    "--visual-button-text": "#ffffff",
    // Destaques de texto sobre fundo claro usam azul por padrão; a página/bloco
    // pode configurar outra cor, sem herdar o amarelo de CTAs legados.
    "--visual-accent": identity.cor_primaria || "#0066cc",
    "--tenant-primary": identity.cor_primaria || "#0066cc",
  };
}
export const HOME_BLOCKS = {
  pagina: "Página inteira", hero: "Banner principal", simulador_home: "Simulador da home",
  produtos: "Seção de produtos", card_veiculos: "Card de veículos", card_imoveis: "Card de imóveis",
  card_patrimonio: "Card de patrimônio", educacao: "Como funciona / benefícios",
  filiais: "Unidades / filiais", estatisticas: "Estatísticas / embaixador", franquia: "Seja um franqueado",
};
export const SIMULATOR_BLOCKS = {
  pagina: "Página inteira", cabecalho: "Cabeçalho", solucao: "Escolha da solução", bem: "Escolha do bem",
  credito: "Valor do crédito", prazo: "Prazo", parcela: "Modalidade da parcela",
  estrategia: "Estratégia avançada", financiamento: "Financiamento", resultado: "Resultado da simulação",
};
export function visualBlocksForPage(page: string): Record<string, string> {
  if (page === "/") return HOME_BLOCKS;
  if (page === "/simulador") return SIMULATOR_BLOCKS;
  if (page === "/grupos") return { pagina: "Página inteira", cabecalho: "Cabeçalho", tabela: "Tabela de grupos", totais: "Resumo / totais" };
  return { pagina: "Página inteira", cabecalho: "Cabeçalho / banner", conteudo: "Conteúdo" };
}
export function safeImageUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048 || /[\s<>"'\\]/.test(value)) return "";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try { return new URL(value).protocol === "https:" ? value : ""; } catch { return ""; }
}
export function normalizePageAppearance(value: unknown): SitePagesAppearance {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: SitePagesAppearance = {};
  for (const [page, blocks] of Object.entries(value).slice(0, 80)) {
    if (!/^\/[a-zA-Z0-9/_-]*$/.test(page) || !blocks || typeof blocks !== "object" || Array.isArray(blocks)) continue;
    const allowed = visualBlocksForPage(page);
    result[page] = {};
    for (const [id, raw] of Object.entries(blocks)) {
      if (!Object.hasOwn(allowed, id) || !raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const block: VisualBlockConfig = {};
      for (const key of Object.keys(VISUAL_COLORS) as VisualColor[]) {
        const color = (raw as Record<string, unknown>)[key];
        if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) block[key] = color;
      }
      const image = safeImageUrl((raw as VisualBlockConfig).imagem_url);
      if (image) block.imagem_url = image;
      const fit = (raw as VisualBlockConfig).imagem_ajuste;
      if (fit === "cover" || fit === "contain") block.imagem_ajuste = fit;
      const position = (raw as VisualBlockConfig).imagem_posicao;
      if (position && ["center", "top", "bottom", "left", "right", "top-left", "top-right"].includes(position)) block.imagem_posicao = position;
      result[page][id] = block;
    }
  }
  return result;
}
const variables: Record<VisualColor, string> = {
  cor_fundo: "--visual-bg", cor_titulo: "--visual-title", cor_texto: "--visual-text",
  cor_destaque: "--visual-accent", cor_botao: "--visual-button", cor_texto_botao: "--visual-button-text",
};
export function pageAppearanceCss(identity: SiteVisualIdentity, page: string): string {
  const config = normalizePageAppearance(identity.paginas_blocos)[page] || {};
  const root = `.site-appearance[data-site-page="${page.replace(/[^a-zA-Z0-9/_-]/g, "")}"]`;
  return Object.entries(config).sort(([a], [b]) => a === "pagina" ? -1 : b === "pagina" ? 1 : 0).map(([id, block]) => {
    const selector = id === "pagina" ? root : `${root} [data-site-block="${id}"]`;
    const styles = (Object.keys(variables) as VisualColor[]).flatMap(key => block[key] ? [`${variables[key]}:${block[key]}!important`] : []);
    if (block.cor_fundo) styles.push(`background-color:${block.cor_fundo}!important`, "background-image:none!important");
    // Na home as imagens substituem o slot existente; nas páginas operacionais são fundos do bloco.
    const photoSlot = page === "/" && ["hero", "card_veiculos", "card_imoveis", "card_patrimonio", "filiais", "estatisticas"].includes(id);
    if (!photoSlot && (page === "/" || id !== "pagina") && block.imagem_url) styles.push(`background-image:url("${block.imagem_url}")!important`, `background-size:${block.imagem_ajuste || "cover"}`, `background-position:${(block.imagem_posicao || "center").replace("-", " ")}`);
    const inherited = id === "pagina"
      ? `${root} [data-site-tone]{${(Object.keys(variables) as VisualColor[]).flatMap(key => block[key] ? [`${variables[key]}:${block[key]}!important`] : []).join(";")}}`
      : "";
    return `${selector}{${styles.join(";")}}${inherited}`;
  }).join("\n");
}
export function blockImage(identity: SiteVisualIdentity, page: string, id: string, fallback: string) {
  return normalizePageAppearance(identity.paginas_blocos)[page]?.[id]?.imagem_url || fallback;
}
export function visibleModelMenus<T extends { id: string; ativo?: boolean; obrigatorio?: boolean }>(catalog: T[], enabled: string[]) {
  const selected = new Set(enabled);
  return catalog.filter(item => item.ativo !== false && (item.obrigatorio === true || selected.has(item.id)));
}
