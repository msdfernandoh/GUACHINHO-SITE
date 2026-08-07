/**
 * Catálogo de templates de site de parceiro — controlado pela plataforma.
 * Sem page builder livre; sem HTML/JS arbitrário persistido.
 */

export type SiteTemplateCodigo = "institucional_v1";

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
