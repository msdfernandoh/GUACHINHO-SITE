import type { ImobiliariaRow } from "@/lib/imoveis/types";

export type ImobiliariaPublic = Pick<
  ImobiliariaRow,
  | "id"
  | "nome"
  | "slug"
  | "logo_url"
  | "banner_url"
  | "cidade"
  | "estado"
  | "endereco"
  | "numero"
  | "bairro"
  | "complemento"
  | "telefone"
  | "whatsapp"
  | "site"
  | "descricao_curta"
  | "descricao"
>;

export function toImobiliariaPublic(row: Partial<ImobiliariaRow> & { id: string; nome: string; slug: string }): ImobiliariaPublic {
  return {
    id: row.id,
    nome: row.nome,
    slug: row.slug,
    logo_url: row.logo_url ?? null,
    banner_url: row.banner_url ?? null,
    cidade: row.cidade ?? null,
    estado: row.estado ?? null,
    endereco: row.endereco ?? null,
    numero: row.numero ?? null,
    bairro: row.bairro ?? null,
    complemento: row.complemento ?? null,
    telefone: row.telefone ?? null,
    whatsapp: row.whatsapp ?? null,
    site: row.site ?? null,
    descricao_curta: row.descricao_curta ?? null,
    descricao: row.descricao ?? null,
  };
}

export function resolveWhatsappImobiliaria(
  imob: Pick<ImobiliariaPublic, "whatsapp" | "telefone">,
  fallbackPrincipal?: string | null,
): string | null {
  const w = imob.whatsapp?.replace(/\D/g, "");
  if (w && w.length >= 10) return w;
  const t = imob.telefone?.replace(/\D/g, "");
  if (t && t.length >= 10) return t;
  const f = fallbackPrincipal?.replace(/\D/g, "");
  if (f && f.length >= 10) return f;
  return null;
}

export function whatsappImobiliariaUrl(
  numeroDigits: string,
  mensagem = "Olá! Vi os imóveis no site Gauchinho e gostaria de mais informações.",
): string {
  return `https://wa.me/${numeroDigits}?text=${encodeURIComponent(mensagem)}`;
}

export function normalizeSiteUrl(site: string | null | undefined): string | null {
  const raw = site?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}
