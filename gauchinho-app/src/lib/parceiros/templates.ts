/**
 * Catálogo de templates de site de parceiro — controlado pela plataforma.
 * Sem page builder livre; sem HTML/JS arbitrário persistido.
 */

export type SiteTemplateCodigo = "institucional_v1" | "racon_inspired";

export type SiteTemplateDef = {
  codigo: SiteTemplateCodigo;
  nome: string;
  descricao: string;
  componentes: readonly string[];
  estrutura: readonly string[];
  menusPermitidos: readonly string[];
  camposConfiguraveis: readonly string[];
  regrasObrigatorias: readonly string[];
  /** Sempre exibe identificação da empresa tenant no rodapé/header. */
  exigeIdentificacaoTenant: boolean;
};

export const SITE_TEMPLATES: Record<SiteTemplateCodigo, SiteTemplateDef> = {
  institucional_v1: {
    codigo: "institucional_v1",
    nome: "Institucional v1",
    descricao: "Site institucional do parceiro com páginas liberáveis e branding controlado.",
    componentes: [
      "hero",
      "sobre",
      "servicos",
      "cta_contato",
      "rodape_tenant",
    ],
    estrutura: ["header", "main", "footer"],
    menusPermitidos: [
      "INICIO",
      "QUEM_SOMOS",
      "CONSORCIO",
      "SIMULADOR",
      "GRUPOS",
      "CARTAS_CONTEMPLADAS",
      "IMOVEIS",
      "EVENTOS",
      "CALCULADORAS",
      "INDICACAO",
      "CONTATO",
    ],
    camposConfiguraveis: [
      "nome_site",
      "descricao",
      "branding",
      "menus",
      "whatsapp",
      "seo",
    ],
    regrasObrigatorias: [
      "org_ativa",
      "branding_minimo",
      "menus_allowlist",
      "identificacao_tenant",
    ],
    exigeIdentificacaoTenant: true,
  },
  racon_inspired: {
    codigo: "racon_inspired",
    nome: "Racon Inspired",
    descricao: "Modelo comercial Racon publicado no catálogo SaaS, adaptado ao portal parceiro.",
    componentes: ["hero", "simulador", "segmentos", "como_funciona", "contato", "rodape_tenant"],
    estrutura: ["header", "main", "footer"],
    menusPermitidos: ["INICIO", "CONSORCIO", "SIMULADOR", "GRUPOS", "INDICACAO", "CONTATO"],
    camposConfiguraveis: ["nome_site", "branding", "whatsapp", "seo"],
    regrasObrigatorias: ["org_ativa", "modelo_publicado", "identificacao_tenant"],
    exigeIdentificacaoTenant: true,
  },
};

export const TEMPLATE_CODIGOS = Object.keys(SITE_TEMPLATES) as SiteTemplateCodigo[];

export function getTemplate(codigo: string): SiteTemplateDef | null {
  if (codigo in SITE_TEMPLATES) {
    return SITE_TEMPLATES[codigo as SiteTemplateCodigo];
  }
  return null;
}

export function isTemplateCodigo(codigo: string): codigo is SiteTemplateCodigo {
  return codigo in SITE_TEMPLATES;
}
