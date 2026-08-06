import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getConfigJsonPublic, DEFAULT_SITE } from "@/server/config";
import { EMPRESA_B_SLUG, GAUCHINHO_SLUG } from "./constants";
import { resolveBrandingFallbackKind } from "./branding-rules";
import { EMPRESA_B_DEV_BRANDING, GAUCHINHO_DEFAULT_COLORS } from "./branding-defaults";

export type EmpresaBranding = {
  id: string;
  empresa_id: string;
  nome_site: string;
  subtitulo: string;
  descricao_institucional: string;
  logo_url: string | null;
  logo_claro_url: string | null;
  logo_escuro_url: string | null;
  favicon_url: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  cor_destaque: string | null;
  telefone: string;
  whatsapp: string;
  email_contato: string;
  redes_sociais: Record<string, string>;
  seo_titulo: string | null;
  seo_descricao: string | null;
  status_publicacao: "RASCUNHO" | "PUBLICADO";
};

export { EMPRESA_B_DEV_BRANDING, GAUCHINHO_DEFAULT_COLORS } from "./branding-defaults";

function emptyInstitutionalBranding(empresaId: string, nome: string): EmpresaBranding {
  return {
    id: "",
    empresa_id: empresaId,
    nome_site: nome,
    subtitulo: "",
    descricao_institucional: "",
    logo_url: null,
    logo_claro_url: null,
    logo_escuro_url: null,
    favicon_url: null,
    cor_primaria: null,
    cor_secundaria: null,
    cor_destaque: null,
    telefone: "",
    whatsapp: "",
    email_contato: "",
    redes_sociais: {},
    seo_titulo: null,
    seo_descricao: null,
    status_publicacao: "RASCUNHO",
  };
}

async function legacyGauchinhoBrandingFromConfig(empresaId: string): Promise<EmpresaBranding> {
  const site = await getConfigJsonPublic("site", DEFAULT_SITE);
  return {
    id: "",
    empresa_id: empresaId,
    nome_site: site.nomeEmpresa || "Gauchinho Escritório de Soluções Financeiras",
    subtitulo: site.subtitulo ?? "",
    descricao_institucional: "",
    logo_url: site.logoUrl ?? null,
    logo_claro_url: null,
    logo_escuro_url: null,
    favicon_url: null,
    cor_primaria: GAUCHINHO_DEFAULT_COLORS.cor_primaria,
    cor_secundaria: GAUCHINHO_DEFAULT_COLORS.cor_secundaria,
    cor_destaque: GAUCHINHO_DEFAULT_COLORS.cor_destaque,
    telefone: "",
    whatsapp: "",
    email_contato: "",
    redes_sociais: {},
    seo_titulo: null,
    seo_descricao: null,
    status_publicacao: "PUBLICADO",
  };
}

async function applyFallback(
  kind: ReturnType<typeof resolveBrandingFallbackKind>,
  empresaId: string,
  slug: string,
): Promise<EmpresaBranding | null> {
  if (kind === "legacy_gauchinho") return legacyGauchinhoBrandingFromConfig(empresaId);
  if (kind === "dev_empresa_b") {
    return {
      ...EMPRESA_B_DEV_BRANDING,
      id: "dev-empresa-b-branding",
      empresa_id: empresaId,
    };
  }
  if (slug === GAUCHINHO_SLUG || slug === EMPRESA_B_SLUG) {
    return emptyInstitutionalBranding(empresaId, slug);
  }
  return null;
}

/**
 * Lê branding público da empresa.
 * Fallback legado: SOMENTE Gauchinho.
 */
export async function getEmpresaBrandingPublic(input: {
  empresaId: string;
  slug: string;
}): Promise<EmpresaBranding | null> {
  const { empresaId, slug } = input;
  const isDev = process.env.NODE_ENV === "development";

  if (empresaId.startsWith("emergency-") || empresaId.startsWith("dev-")) {
    if (slug === GAUCHINHO_SLUG) return legacyGauchinhoBrandingFromConfig(empresaId);
    const kind = resolveBrandingFallbackKind({
      slug,
      hasBrandingRow: false,
      isDevelopment: isDev,
    });
    return applyFallback(kind, empresaId, slug);
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("empresa_branding")
      .select("*")
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (error || !data) {
      const kind = resolveBrandingFallbackKind({
        slug,
        hasBrandingRow: false,
        isDevelopment: isDev,
      });
      return applyFallback(kind, empresaId, slug);
    }

    return data as EmpresaBranding;
  } catch {
    const kind = resolveBrandingFallbackKind({
      slug,
      hasBrandingRow: false,
      isDevelopment: isDev,
    });
    return applyFallback(kind, empresaId, slug);
  }
}
