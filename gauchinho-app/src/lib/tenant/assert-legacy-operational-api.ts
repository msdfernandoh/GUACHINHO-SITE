import { NextResponse } from "next/server";
import { tenantAllowsLegacyOperationalData } from "./operational-access";
import { resolveTenantForRequest } from "./resolve-by-host";
import { TENANT_EMPRESA_ID_HEADER, TENANT_SLUG_HEADER } from "./constants";

export type OperationalApiGuardResult =
  | { allow: true; slug: string }
  | { allow: false; status: number; error: string };

/**
 * Avaliação pura (testável) — não confia em x-tenant-* do cliente.
 * Resolve o tenant pelo Host da requisição.
 */
export async function evaluateLegacyOperationalApiAccess(input: {
  hostHeader: string | null;
  url?: string;
}): Promise<OperationalApiGuardResult> {
  const searchParams = input.url ? new URL(input.url).searchParams : undefined;
  const resolved = await resolveTenantForRequest({
    hostHeader: input.hostHeader,
    searchParams,
  });

  if (!resolved.ok) {
    return { allow: false, status: 404, error: "Site não configurado." };
  }

  if (!tenantAllowsLegacyOperationalData(resolved.tenant.slug)) {
    return {
      allow: false,
      status: 404,
      error: "Módulo ainda não disponível para este site.",
    };
  }

  return { allow: true, slug: resolved.tenant.slug };
}

/**
 * Defesa em profundidade para Route Handlers operacionais.
 * Ignora qualquer x-tenant-* presente no Request (pode ter sido injetado pelo cliente
 * se o proxy não rodou). Re-resolve pelo Host.
 */
export async function rejectIfTenantBlocksLegacyOperationalApi(
  request: Request,
): Promise<NextResponse | null> {
  // Descarta headers de tenant do cliente — não usar para autorização.
  void request.headers.get(TENANT_EMPRESA_ID_HEADER);
  void request.headers.get(TENANT_SLUG_HEADER);

  const result = await evaluateLegacyOperationalApiAccess({
    hostHeader: request.headers.get("host"),
    url: request.url,
  });

  if (result.allow) return null;

  return NextResponse.json({ error: result.error }, { status: result.status });
}
