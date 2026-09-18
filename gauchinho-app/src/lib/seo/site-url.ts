export const CANONICAL_PRODUCTION_ORIGIN = "https://www.gauchinhoconsorcios.com.br";
export const CANONICAL_GAUCHINHO_ORIGIN = "https://www.gauchinhoconsorcios.com.br";
export const CANONICAL_RACON_ORIGIN = "https://www.raconsinop.com.br";

function normalizeSiteUrl(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  let url = trimmed.replace(/\/$/, "");
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

/**
 * URL pública padrão do site, sem barra final.
 * Em produção na Vercel nunca retorna vazio (evita sitemap com localhost).
 */
export function getPublicSiteUrl(): string | undefined {
  const explicit = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (explicit) return explicit;

  if (process.env.VERCEL_ENV === "production") {
    const vercelProd = normalizeSiteUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
    if (vercelProd) return vercelProd;
    return CANONICAL_PRODUCTION_ORIGIN;
  }

  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return normalizeSiteUrl(process.env.VERCEL_URL);
  }

  if (process.env.NODE_ENV === "production") {
    return CANONICAL_PRODUCTION_ORIGIN;
  }

  return undefined;
}

/** Para sitemap/robots: localhost só em desenvolvimento local. */
export function resolvePublicSiteUrl(): string {
  return getPublicSiteUrl() ?? "http://localhost:3000";
}

/** Verifica se o host refere-se ao domínio da Racon Sinop */
export function isRaconHost(host?: string | null): boolean {
  if (!host) return false;
  const lower = host.toLowerCase().trim();
  return lower.includes("raconsinop");
}

/**
 * Resolve a origem canônica com base no header Host recebido.
 * Trata transparentemente raconsinop.com.br e gauchinhoconsorcios.com.br.
 */
export function resolveOriginFromHost(host?: string | null, protocol = "https"): string {
  if (!host) return resolvePublicSiteUrl();
  const cleanHost = host.trim().replace(/\/.*$/, "");
  if (cleanHost.includes("localhost") || cleanHost.startsWith("127.0.0.1")) {
    return `http://${cleanHost}`;
  }
  if (isRaconHost(cleanHost)) {
    return CANONICAL_RACON_ORIGIN;
  }
  if (cleanHost.includes("gauchinhoconsorcios")) {
    return CANONICAL_GAUCHINHO_ORIGIN;
  }
  return `${protocol}://${cleanHost}`;
}
