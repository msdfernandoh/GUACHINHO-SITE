const CANONICAL_PRODUCTION_ORIGIN = "https://www.gauchinhoconsorcios.com.br";

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
 * URL pública do site, sem barra final.
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
