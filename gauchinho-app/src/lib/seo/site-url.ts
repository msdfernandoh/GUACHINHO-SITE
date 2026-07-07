/** URL pública do site (NEXT_PUBLIC_SITE_URL), sem barra final. */
export function getPublicSiteUrl(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return undefined;
  return raw.replace(/\/$/, "");
}
