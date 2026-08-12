import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { isContratacaoDraftPayload, type ContratacaoDraftPayload } from "./draft";

const MAX_DRAFT_LINK_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function secret() {
  const value = process.env.CONTRATACAO_DRAFT_LINK_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Link temporário indisponível. Configure CONTRATACAO_DRAFT_LINK_SECRET.");
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function criarContratacaoDraftLink(draft: ContratacaoDraftPayload, origin: string) {
  const payload = Buffer.from(JSON.stringify({ draft, expiresAt: Date.now() + MAX_DRAFT_LINK_AGE_MS })).toString("base64url");
  const signature = sign(payload);
  return `${origin}/proposta/rascunho?d=${encodeURIComponent(payload)}&s=${encodeURIComponent(signature)}`;
}

export function validarContratacaoDraftLink(payload: unknown, signature: unknown): ContratacaoDraftPayload {
  if (typeof payload !== "string" || typeof signature !== "string") {
    throw new Error("Link de simulação inválido.");
  }
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error("Link de simulação inválido.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new Error("Link de simulação inválido.");
  }
  const envelope = parsed as { draft?: unknown; expiresAt?: unknown };
  if (typeof envelope.expiresAt !== "number" || envelope.expiresAt < Date.now()) {
    throw new Error("Este link de simulação expirou. Gere outro link.");
  }
  if (!isContratacaoDraftPayload(envelope.draft)) throw new Error("Link de simulação inválido.");
  return envelope.draft;
}
