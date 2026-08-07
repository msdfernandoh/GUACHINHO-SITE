import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

export type PropostaPdfScopeFields = {
  organizacao_parceira_id?: string | null;
  participant_id?: string | null;
  empresa_id?: string | null;
};

/** Propostas da área parceiro / escopo comercial — nunca públicas por UUID. */
export function isPropostaPdfParceiroScoped(row: PropostaPdfScopeFields): boolean {
  return Boolean(row.organizacao_parceira_id || row.participant_id);
}

function pdfPublicSecret(): string {
  const secret =
    process.env.PROPOSTA_PDF_PUBLIC_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) {
    throw new Error("Segredo de PDF público indisponível no servidor.");
  }
  return secret;
}

/** Token opaco derivado do id (não é o UUID; exige segredo de servidor). */
export function createPropostaPdfPublicToken(propostaId: string): string {
  return createHmac("sha256", pdfPublicSecret())
    .update(`proposta-pdf-v1:${propostaId}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyPropostaPdfPublicToken(propostaId: string, token: string | null | undefined): boolean {
  if (!token || !/^[a-f0-9]{32}$/i.test(token)) return false;
  const expected = createPropostaPdfPublicToken(propostaId);
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(token.toLowerCase(), "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function buildPropostaPdfPublicPath(propostaId: string): string {
  const t = createPropostaPdfPublicToken(propostaId);
  return `/api/propostas/${propostaId}/pdf?t=${encodeURIComponent(t)}`;
}

/**
 * Gate da rota pública.
 * - escopo parceiro → negado (usar área autenticada)
 * - legado público → exige token HMAC
 */
export function assertPropostaPdfPublicAccess(input: {
  propostaId: string;
  token: string | null | undefined;
  row: PropostaPdfScopeFields;
}): { ok: true } | { ok: false; status: 404; error: string } {
  if (isPropostaPdfParceiroScoped(input.row)) {
    return { ok: false, status: 404, error: "PDF indisponível" };
  }
  if (!verifyPropostaPdfPublicToken(input.propostaId, input.token)) {
    return { ok: false, status: 404, error: "PDF indisponível" };
  }
  return { ok: true };
}
