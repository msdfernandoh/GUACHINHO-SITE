import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { isContratacaoDraftPayload, type ContratacaoDraftPayload } from "./draft";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_DRAFT_LINK_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function secret() {
  const value = process.env.CONTRATACAO_DRAFT_LINK_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Link temporário indisponível. Configure CONTRATACAO_DRAFT_LINK_SECRET.");
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function criarContratacaoDraftLink(draft: ContratacaoDraftPayload, origin: string) {
  if (!draft.empresa_id) throw new Error("Empresa não identificada para o link da proposta.");
  const admin = createAdminClient();
  const codigo = randomBytes(9).toString("base64url");
  const { error } = await admin.from("proposta_links_curtos").insert({
    empresa_id: draft.empresa_id,
    codigo,
    payload: draft,
    expires_at: new Date(Date.now() + MAX_DRAFT_LINK_AGE_MS).toISOString(),
  });
  if (error) throw new Error("Não foi possível gerar o link curto da proposta.");
  return `${origin}/proposta/rascunho?c=${codigo}`;
}

export async function validarContratacaoDraftLinkCurto(codigo: unknown, empresaId: string) {
  if (typeof codigo !== "string" || !/^[A-Za-z0-9_-]{12}$/.test(codigo)) {
    throw new Error("Link de simulação inválido.");
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("proposta_links_curtos")
    .select("payload,expires_at")
    .eq("codigo", codigo)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (error || !data) throw new Error("Link de simulação inválido.");
  if (new Date(data.expires_at).getTime() < Date.now()) throw new Error("Este link de simulação expirou. Gere outro link.");
  if (!isContratacaoDraftPayload(data.payload)) throw new Error("Link de simulação inválido.");
  return data.payload;
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
