import "server-only";

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOperationalTenantForApi } from "@/lib/tenant/assert-legacy-operational-api";

export async function authorizePublicIngress(
  request: Request,
  action: string,
  options: { limit?: number; windowSeconds?: number } = {},
): Promise<
  | { ok: true; empresaId: string; slug: string }
  | { ok: false; response: NextResponse }
> {
  const tenant = await resolveOperationalTenantForApi(request);
  if (!tenant.ok) return tenant;

  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]?.trim();
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const salt = process.env.PUBLIC_RATE_LIMIT_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!salt) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Ingresso público temporariamente indisponível." },
        { status: 503 },
      ),
    };
  }
  const fingerprint = createHash("sha256")
    .update(`${salt}|${tenant.empresaId}|${ip}|${userAgent}`)
    .digest("hex");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("rpc_consumir_limite_ingresso_publico", {
    p_empresa_id: tenant.empresaId,
    p_acao: action,
    p_fingerprint_hash: fingerprint,
    p_limite: options.limit ?? 20,
    p_janela_segundos: options.windowSeconds ?? 60,
  });
  if (error) {
    console.error("[public-ingress]", action, error.message);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Ingresso público temporariamente indisponível." },
        { status: 503 },
      ),
    };
  }
  if (!data) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Muitas solicitações. Aguarde um minuto e tente novamente." },
        { status: 429, headers: { "retry-after": "60" } },
      ),
    };
  }
  return tenant;
}
