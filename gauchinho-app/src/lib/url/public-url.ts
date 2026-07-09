import { resolvePublicSiteUrl } from "@/lib/seo/site-url";

const DEFAULT_PUBLIC_ORIGIN = "https://gauchinhoconsorcios.com.br";

function normalizeBase(raw: string): string {
  let url = raw.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

/**
 * Origem pública do site (sem barra final), para links copiáveis e WhatsApp.
 * Nunca retorna string vazia.
 */
export function getPublicSiteUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return normalizeBase(explicit);
  return resolvePublicSiteUrl() || DEFAULT_PUBLIC_ORIGIN;
}

/** Preferência: URL do site em config admin; senão env / fallback. */
export function resolvePublicBaseUrl(configSiteUrl?: string | null): string {
  const fromConfig = configSiteUrl?.trim();
  if (fromConfig) return normalizeBase(fromConfig);
  return getPublicSiteUrl();
}

export function buildPublicUrl(path: string, baseOverride?: string): string {
  const base = baseOverride ? normalizeBase(baseOverride) : getPublicSiteUrl();
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export function buildPropostaPublicUrl(publicToken: string, baseOverride?: string): string {
  return buildPublicUrl(`/proposta/${publicToken}`, baseOverride);
}

/** Garante URL absoluta quando a API ou legado retornam apenas path. */
export function ensureAbsolutePropostaUrl(
  urlOrPath: string,
  publicToken: string,
  baseOverride?: string,
): string {
  if (/^https?:\/\//i.test(urlOrPath.trim())) {
    return urlOrPath.trim();
  }
  const path = urlOrPath.startsWith("/") ? urlOrPath : `/proposta/${publicToken}`;
  return buildPublicUrl(path, baseOverride);
}
