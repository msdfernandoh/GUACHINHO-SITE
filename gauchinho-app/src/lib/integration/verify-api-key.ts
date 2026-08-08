import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { GAUCHINHO_EMPRESA_ID } from "@/lib/administradoras/constants";

function safeEquals(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

/**
 * Autentica a API key de integração.
 * Retorna null se OK (compat), ou Response de erro.
 *
 * Lacuna estrutural documentada (E6): não há tabela de API keys multi-tenant.
 * A chave de ambiente `GAUCHINHO_INTEGRATION_API_KEY` é vinculada exclusivamente
 * à empresa Gauchinho — não autoriza catálogo global nem outros tenants.
 */
export function verifyIntegrationApiKey(request: Request): NextResponse | null {
  const resolved = resolveIntegrationEmpresa(request);
  if (resolved instanceof NextResponse) return resolved;
  return null;
}

export type IntegrationEmpresaAuth = {
  empresaId: string;
  slug: "gauchinho";
};

/**
 * Resolve a empresa autorizada pela API key.
 * Somente Gauchinho enquanto não houver modelo multi-tenant de keys.
 */
export function resolveIntegrationEmpresa(
  request: Request,
): IntegrationEmpresaAuth | NextResponse {
  const expected = process.env.GAUCHINHO_INTEGRATION_API_KEY?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "Integração não configurada (GAUCHINHO_INTEGRATION_API_KEY)" },
      { status: 503 },
    );
  }
  const header = request.headers.get("x-api-key")?.trim();
  const auth = request.headers.get("authorization")?.trim();
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const provided = header || bearer;
  if (!provided || !safeEquals(provided, expected)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  return { empresaId: GAUCHINHO_EMPRESA_ID, slug: "gauchinho" };
}
