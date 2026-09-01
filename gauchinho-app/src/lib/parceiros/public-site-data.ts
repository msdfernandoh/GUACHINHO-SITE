import { normalizeDigits } from "./normalize";
import type { SiteBranding } from "./branding";
import type { MenuCodigo } from "./menus";
import { MENU_CATALOGO, isMenuCodigo } from "./menus";
import { getTemplate } from "./templates";

/** Hierarquia documentada: site → organização → empresa tenant. */
export type PartnerPublicContact = {
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
};

export type PartnerPublicViewModel = {
  site_id: string;
  empresa_id: string;
  empresa_slug: string;
  empresa_nome: string;
  organizacao_id: string;
  organizacao_nome: string;
  slug: string;
  nome_site: string;
  descricao: string;
  template_codigo: string;
  modelo_identidade: Record<string, unknown>;
  status_publicacao: string;
  canal_principal: string;
  whatsapp_modo: string;
  logo_url: string | null;
  logo_claro_url: string | null;
  logo_escuro_url: string | null;
  favicon_url: string | null;
  banner_url: string | null;
  cor_primaria: string;
  cor_secundaria: string;
  cor_destaque: string;
  texto_hero: string;
  texto_sobre: string;
  contato: PartnerPublicContact;
  whatsapp_cta: string | null;
  whatsapp_link: string | null;
  seo_titulo: string;
  seo_descricao: string;
  menus: Array<{ codigo: MenuCodigo; label: string; href: string }>;
  tenant_identificacao: string;
  is_preview: boolean;
};

/** Remove tags HTML — sem HTML/JS arbitrário no render. */
export function sanitizePublicText(raw: string | null | undefined, max = 4000): string {
  if (!raw) return "";
  return String(raw)
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .trim()
    .slice(0, max);
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    const s = typeof v === "string" ? v.trim() : "";
    if (s) return s;
  }
  return null;
}

/**
 * Menus públicos do template institucional_v1.
 * Só âncoras/seções implementadas — sem links quebrados.
 * Funcionalidades ainda sem página no site do parceiro ficam ocultas.
 */
export const INSTITUCIONAL_V1_SECTIONS: Partial<
  Record<MenuCodigo, { label: string; href: string }>
> = {
  INICIO: { label: "Início", href: "#inicio" },
  QUEM_SOMOS: { label: "Quem somos", href: "#quem-somos" },
  CONSORCIO: { label: "Consórcio", href: "#consorcio" },
  CONTATO: { label: "Contato", href: "#contato" },
  INDICACAO: { label: "Indicação", href: "#indicacao" },
};

export function resolvePublicMenus(input: {
  templateCodigo: string;
  menus: unknown;
}): Array<{ codigo: MenuCodigo; label: string; href: string }> {
  const template = getTemplate(input.templateCodigo);
  if (!template) return [];

  const raw = Array.isArray(input.menus) ? input.menus : [];
  const enabled = new Set<string>();
  for (const m of raw) {
    const codigo = typeof m?.codigo === "string" ? m.codigo : "";
    if (!codigo || m?.habilitado === false) continue;
    if (!isMenuCodigo(codigo)) continue;
    if (!(template.menusPermitidos as readonly string[]).includes(codigo)) continue;
    enabled.add(codigo);
  }

  const out: Array<{ codigo: MenuCodigo; label: string; href: string }> = [];
  for (const item of MENU_CATALOGO) {
    if (!enabled.has(item.codigo)) continue;
    const section = INSTITUCIONAL_V1_SECTIONS[item.codigo];
    if (!section) continue; // ocultar sem página segura
    out.push({ codigo: item.codigo, label: section.label, href: section.href });
  }
  return out;
}

export function resolveWhatsappCta(input: {
  modo: string;
  siteWhatsapp: string | null | undefined;
  siteBrandingWhatsapp: string | null | undefined;
  orgWhatsapp: string | null | undefined;
  empresaWhatsapp: string | null | undefined;
}): { digits: string | null; link: string | null } {
  let chosen: string | null = null;
  const modo = (input.modo || "EMPRESA").toUpperCase();
  if (modo === "PROPRIO") {
    chosen = firstNonEmpty(input.siteWhatsapp, input.siteBrandingWhatsapp);
  } else if (modo === "CONFIG") {
    chosen = firstNonEmpty(input.siteBrandingWhatsapp, input.siteWhatsapp, input.orgWhatsapp);
  } else {
    // EMPRESA — contato público da empresa; org como fallback público
    chosen = firstNonEmpty(input.empresaWhatsapp, input.orgWhatsapp, input.siteWhatsapp);
  }
  const digits = normalizeDigits(chosen);
  if (!digits || digits.length < 10) return { digits: null, link: null };
  return { digits, link: `https://wa.me/${digits}` };
}

export function buildPartnerPublicViewModel(input: {
  site: {
    id: string;
    empresa_id: string;
    organizacao_parceira_id: string;
    slug: string;
    nome_site: string;
    descricao: string;
    template_codigo: string;
    status_publicacao: string;
    canal_principal: string;
    whatsapp_modo: string;
    whatsapp: string | null;
    branding: SiteBranding | Record<string, unknown>;
    menus: unknown;
    seo: Record<string, unknown> | null;
  };
  org: {
    id: string;
    nome_fantasia: string;
    logo_url: string | null;
    telefone: string | null;
    whatsapp: string | null;
    email: string | null;
    instagram: string | null;
  };
  empresa: {
    id: string;
    slug: string;
    nome: string;
    logo_url: string | null;
    cor_primaria?: string | null;
    cor_secundaria?: string | null;
    cor_destaque?: string | null;
    banner_url?: string | null;
    telefone: string | null;
    whatsapp: string | null;
    email: string | null;
  };
  isPreview?: boolean;
}): PartnerPublicViewModel {
  const b = (input.site.branding ?? {}) as SiteBranding;
  const seo = input.site.seo ?? {};

  const modo = b.identidade_visual_modo;
  const isHerdarMaster = modo === "HERDAR_MASTER";

  // Se HERDAR_MASTER, herda estritamente da Master Franquia.
  // Se PERSONALIZADA ou indefinido (compatibilidade legada), usa fallback site → org → empresa.
  const logo_url = isHerdarMaster
    ? input.empresa.logo_url
    : firstNonEmpty(b.logo_url, input.org.logo_url, input.empresa.logo_url);

  const cor_primaria = isHerdarMaster
    ? input.empresa.cor_primaria || "#0A1628"
    : firstNonEmpty(b.cor_primaria) || input.empresa.cor_primaria || "#0A1628";

  const cor_secundaria = isHerdarMaster
    ? input.empresa.cor_secundaria || "#0D1F3C"
    : firstNonEmpty(b.cor_secundaria) || input.empresa.cor_secundaria || "#0D1F3C";

  const cor_destaque = isHerdarMaster
    ? input.empresa.cor_destaque || "#C9A84C"
    : firstNonEmpty(b.cor_destaque) || input.empresa.cor_destaque || "#C9A84C";

  const banner_url = isHerdarMaster
    ? input.empresa.banner_url || null
    : firstNonEmpty(b.banner_url, input.empresa.banner_url);

  const contato: PartnerPublicContact = {
    telefone: firstNonEmpty(b.telefone, input.org.telefone, input.empresa.telefone),
    whatsapp: null,
    email: firstNonEmpty(b.email, input.org.email, input.empresa.email),
    instagram: firstNonEmpty(b.instagram, input.org.instagram),
  };

  const wa = resolveWhatsappCta({
    modo: input.site.whatsapp_modo,
    siteWhatsapp: input.site.whatsapp,
    siteBrandingWhatsapp: b.whatsapp,
    orgWhatsapp: input.org.whatsapp,
    empresaWhatsapp: input.empresa.whatsapp,
  });
  contato.whatsapp = wa.digits;

  const nome_site = sanitizePublicText(input.site.nome_site, 120) || input.org.nome_fantasia;
  const seo_titulo =
    sanitizePublicText(String(seo.titulo ?? ""), 120) ||
    `${nome_site} | ${input.empresa.nome}`;
  const seo_descricao =
    sanitizePublicText(String(seo.descricao ?? ""), 300) ||
    sanitizePublicText(input.site.descricao, 300) ||
    `Consórcio com ${nome_site}.`;

  return {
    site_id: input.site.id,
    empresa_id: input.empresa.id,
    empresa_slug: input.empresa.slug,
    empresa_nome: input.empresa.nome,
    organizacao_id: input.org.id,
    organizacao_nome: input.org.nome_fantasia,
    slug: input.site.slug,
    nome_site,
    descricao: sanitizePublicText(input.site.descricao, 2000),
    template_codigo: input.site.template_codigo,
    modelo_identidade: {
      ...((b.modelo_identidade && typeof b.modelo_identidade === "object" ? b.modelo_identidade : {}) as Record<string, unknown>),
      cor_primaria,
      cor_secundaria,
      cor_destaque,
    },
    status_publicacao: input.site.status_publicacao,
    canal_principal: input.site.canal_principal,
    whatsapp_modo: input.site.whatsapp_modo,
    logo_url,
    logo_claro_url: !isHerdarMaster ? firstNonEmpty(b.logo_claro_url, logo_url) : logo_url,
    logo_escuro_url: !isHerdarMaster ? firstNonEmpty(b.logo_escuro_url, logo_url) : logo_url,
    favicon_url: firstNonEmpty(b.favicon_url),
    banner_url,
    cor_primaria,
    cor_secundaria,
    cor_destaque,
    texto_hero: sanitizePublicText(b.texto_hero, 500) || nome_site,
    texto_sobre: sanitizePublicText(b.texto_sobre, 4000) || sanitizePublicText(input.site.descricao, 4000),
    contato,
    whatsapp_cta: wa.digits,
    whatsapp_link: wa.link,
    seo_titulo,
    seo_descricao,
    menus: resolvePublicMenus({
      templateCodigo: input.site.template_codigo,
      menus: input.site.menus,
    }),
    tenant_identificacao: `Realizado em parceria com ${input.empresa.nome}`,
    is_preview: Boolean(input.isPreview),
  };
}

