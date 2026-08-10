import "server-only";

import type { NextRequest } from "next/server";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { isMaster, isStaff, type UsuarioNegocio } from "@/lib/auth/permissions";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { getUserCompanies } from "@/lib/tenant/context";

export class GestaoApiError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 400 = 403,
  ) {
    super(message);
    this.name = "GestaoApiError";
  }
}

export type GestaoApiAccess = {
  empresaId: string;
  usuario: UsuarioNegocio;
  platformSuperadmin: boolean;
};

export async function requireGestaoApiAccess(
  mode: "read" | "write",
): Promise<GestaoApiAccess> {
  let usuario: UsuarioNegocio;
  try {
    usuario = await requireUsuario();
  } catch {
    throw new GestaoApiError("Não autenticado.", 401);
  }

  const tenant = await getResolvedTenant();
  if (!tenant) {
    throw new GestaoApiError("Tenant não resolvido pelo host.", 403);
  }

  const platformSuperadmin = await isPlatformSuperadmin();
  if (!platformSuperadmin) {
    const vinculos = await getUserCompanies(usuario.id);
    const vinculoAtivo = vinculos.some((vinculo) => vinculo.empresa_id === tenant.empresaId);
    if (!vinculoAtivo) {
      throw new GestaoApiError("Usuário sem vínculo ativo com este tenant.", 403);
    }

    const permitido = mode === "write" ? isMaster(usuario.perfil) : isStaff(usuario.perfil);
    if (!permitido) {
      throw new GestaoApiError("Sem permissão para esta operação.", 403);
    }
  }

  return { empresaId: tenant.empresaId, usuario, platformSuperadmin };
}

/** Route Handlers com cookie não recebem automaticamente a proteção CSRF de Server Actions. */
export function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    throw new GestaoApiError("Origem ausente.", 403);
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    throw new GestaoApiError("Origem inválida.", 403);
  }

  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const expectedHost = forwardedHost || requestUrl.host;
  const expectedProtocol = forwardedProto ? `${forwardedProto}:` : requestUrl.protocol;

  if (originUrl.host !== expectedHost || originUrl.protocol !== expectedProtocol) {
    throw new GestaoApiError("Origem não autorizada.", 403);
  }
}

export function gestaoApiStatus(error: unknown): number {
  return error instanceof GestaoApiError ? error.status : 500;
}

export function gestaoApiMessage(error: unknown): string {
  if (error instanceof GestaoApiError) return error.message;
  return error instanceof Error ? error.message : "Erro interno.";
}
