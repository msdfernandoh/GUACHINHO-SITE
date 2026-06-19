/** Normaliza URL colada no admin (sem protocolo, etc.). */
export function normalizeConteudoImageUrl(raw: string | null | undefined): string {
  const t = raw?.trim() ?? "";
  if (!t) return "";
  if (t.startsWith("/")) return t;
  if (t.startsWith("//")) return `https:${t}`;
  if (!/^https?:\/\//i.test(t)) return `https://${t}`;
  return t;
}

export function isSupabaseStoragePublicUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      (u.hostname.endsWith(".supabase.co") || u.hostname.endsWith(".supabase.in")) &&
      u.pathname.includes("/storage/v1/object/")
    );
  } catch {
    return false;
  }
}
