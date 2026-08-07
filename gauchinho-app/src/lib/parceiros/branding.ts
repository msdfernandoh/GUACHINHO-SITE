export type SiteBranding = {
  logo_url?: string | null;
  logo_claro_url?: string | null;
  logo_escuro_url?: string | null;
  favicon_url?: string | null;
  cor_primaria?: string | null;
  cor_secundaria?: string | null;
  cor_destaque?: string | null;
  banner_url?: string | null;
  texto_hero?: string | null;
  texto_sobre?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  instagram?: string | null;
  redes?: Record<string, string>;
};

export type SiteSeo = {
  titulo?: string | null;
  descricao?: string | null;
};

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function isHttpUrl(v: string | null | undefined): boolean {
  if (!v) return true;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Origem dos dados:
 * - organização: nome_fantasia, telefone/whatsapp/email/instagram padrão (não duplicar no save se vazios)
 * - site pode sobrescrever: branding, SEO, contatos de exibição
 * - empresa tenant: sempre identificação no rodapé (template), nunca editável pelo parceiro
 */
export function validateSiteBranding(
  branding: SiteBranding
): { ok: true; branding: SiteBranding } | { ok: false; error: string } {
  for (const key of [
    "logo_url",
    "logo_claro_url",
    "logo_escuro_url",
    "favicon_url",
    "banner_url",
  ] as const) {
    const v = branding[key];
    if (v && !isHttpUrl(v)) {
      return { ok: false, error: `URL inválida em ${key}.` };
    }
  }
  for (const key of ["cor_primaria", "cor_secundaria", "cor_destaque"] as const) {
    const v = branding[key];
    if (v && !HEX.test(v)) {
      return { ok: false, error: `Cor inválida em ${key} (use #RGB ou #RRGGBB).` };
    }
  }
  return { ok: true, branding };
}

export function brandingMinimoOk(branding: SiteBranding, nomeSite: string): boolean {
  return Boolean(nomeSite.trim() && (branding.cor_primaria || branding.logo_url || branding.texto_hero));
}

export function emptyBranding(): SiteBranding {
  return {
    logo_url: null,
    logo_claro_url: null,
    logo_escuro_url: null,
    favicon_url: null,
    cor_primaria: "#0A1628",
    cor_secundaria: "#0D1F3C",
    cor_destaque: "#C9A84C",
    banner_url: null,
    texto_hero: "",
    texto_sobre: "",
    telefone: null,
    whatsapp: null,
    email: null,
    instagram: null,
    redes: {},
  };
}

export function brandingFromForm(formData: FormData): SiteBranding {
  return {
    logo_url: String(formData.get("logo_url") ?? "") || null,
    logo_claro_url: String(formData.get("logo_claro_url") ?? "") || null,
    logo_escuro_url: String(formData.get("logo_escuro_url") ?? "") || null,
    favicon_url: String(formData.get("favicon_url") ?? "") || null,
    cor_primaria: String(formData.get("cor_primaria") ?? "") || null,
    cor_secundaria: String(formData.get("cor_secundaria") ?? "") || null,
    cor_destaque: String(formData.get("cor_destaque") ?? "") || null,
    banner_url: String(formData.get("banner_url") ?? "") || null,
    texto_hero: String(formData.get("texto_hero") ?? "") || null,
    texto_sobre: String(formData.get("texto_sobre") ?? "") || null,
    telefone: String(formData.get("telefone_site") ?? "") || null,
    whatsapp: String(formData.get("whatsapp_site") ?? "") || null,
    email: String(formData.get("email_site") ?? "") || null,
    instagram: String(formData.get("instagram_site") ?? "") || null,
    redes: {},
  };
}
