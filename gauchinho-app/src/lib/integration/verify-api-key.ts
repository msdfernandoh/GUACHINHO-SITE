import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const CATALOGO_GRUPOS_SCOPE = "catalogo:grupos:ler";

function safeEquals(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

function unauthorized(message = "Unauthorized", status = 401): NextResponse {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function extractApiKey(request: Request): string | null {
  const header = request.headers.get("x-api-key")?.trim();
  const auth = request.headers.get("authorization")?.trim();
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const value = header || bearer;
  return value && value.length >= 24 && value.length <= 512 ? value : null;
}

export function hashIntegrationApiKey(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export type IntegrationEmpresaAuth = {
  empresaId: string;
  slug: string;
  keyId: string | null;
  scopes: string[];
  legacy: boolean;
};

type EmpresaKeyRow = { id: string; slug: string; status: string; ativo: boolean };
type KeyRow = {
  id: string;
  empresa_id: string;
  scopes: unknown;
  ativo: boolean;
  expira_em: string | null;
  empresa: EmpresaKeyRow | EmpresaKeyRow[];
};

function normalizeScopes(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeEmpresa(row: KeyRow["empresa"]): EmpresaKeyRow | null {
  return Array.isArray(row) ? row[0] ?? null : row;
}

async function resolveLegacyKey(
  provided: string,
): Promise<IntegrationEmpresaAuth | NextResponse | null> {
  const legacy = process.env.GAUCHINHO_INTEGRATION_API_KEY?.trim();
  if (!legacy || !safeEquals(provided, legacy)) return null;

  // Compatibilidade temporária: o UUID vem do cadastro, nunca de constante.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("empresas")
    .select("id, slug, status, ativo")
    .eq("slug", "gauchinho")
    .maybeSingle();
  if (error || !data || data.status !== "ativo" || !data.ativo) {
    return unauthorized("Integração legada sem empresa ativa configurada.", 503);
  }
  return {
    empresaId: data.id,
    slug: data.slug,
    keyId: null,
    scopes: [CATALOGO_GRUPOS_SCOPE],
    legacy: true,
  };
}

/** Autentica a chave hashada e devolve a empresa, escopos e identidade da chave. */
export async function resolveIntegrationEmpresa(
  request: Request,
  requiredScope = CATALOGO_GRUPOS_SCOPE,
): Promise<IntegrationEmpresaAuth | NextResponse> {
  const provided = extractApiKey(request);
  if (!provided) return unauthorized();

  const keyHash = hashIntegrationApiKey(provided);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integracao_api_keys")
    .select("id, empresa_id, scopes, ativo, expira_em, empresa:empresas!inner(id, slug, status, ativo)")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error) {
    const legacy = await resolveLegacyKey(provided);
    return legacy ?? unauthorized("Serviço de integração temporariamente indisponível.", 503);
  }
  if (!data) {
    const legacy = await resolveLegacyKey(provided);
    return legacy ?? unauthorized();
  }

  const row = data as unknown as KeyRow;
  const empresa = normalizeEmpresa(row.empresa);
  const scopes = normalizeScopes(row.scopes);
  const expired = row.expira_em ? new Date(row.expira_em).getTime() <= Date.now() : false;
  if (
    !row.ativo || expired || !empresa || empresa.status !== "ativo" || !empresa.ativo ||
    !scopes.includes(requiredScope)
  ) {
    return unauthorized();
  }

  const { data: withinLimit, error: rateError } = await admin.rpc(
    "rpc_consumir_limite_ingresso_publico",
    {
      p_empresa_id: row.empresa_id,
      p_acao: `integration:${requiredScope}`,
      p_fingerprint_hash: keyHash,
      p_limite: 300,
      p_janela_segundos: 60,
    },
  );
  if (rateError) return unauthorized("Serviço de integração temporariamente indisponível.", 503);
  if (!withinLimit) return unauthorized("Limite de requisições excedido.", 429);

  // Telemetria não deve transformar uma leitura autorizada em erro.
  void admin
    .from("integracao_api_keys")
    .update({ ultimo_uso_em: new Date().toISOString() })
    .eq("id", row.id)
    .eq("empresa_id", row.empresa_id);

  return {
    empresaId: row.empresa_id,
    slug: empresa.slug,
    keyId: row.id,
    scopes,
    legacy: false,
  };
}

export async function verifyIntegrationApiKey(request: Request): Promise<NextResponse | null> {
  const resolved = await resolveIntegrationEmpresa(request);
  return resolved instanceof NextResponse ? resolved : null;
}
