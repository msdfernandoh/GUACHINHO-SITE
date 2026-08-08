import { NextResponse } from "next/server";
import { rejectIfTenantBlocksLegacyOperationalApi } from "@/lib/tenant/assert-legacy-operational-api";
import { resolveIntegrationEmpresa } from "@/lib/integration/verify-api-key";
import { isGrupoNotFoundError, GRUPO_NOT_FOUND_MESSAGE } from "@/lib/grupos/catalogo-autorizado";
import {
  getGrupoAutorizadoForEmpresa,
  listCotasAutorizadasForEmpresa,
} from "@/lib/grupos/catalogo-autorizado-service";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const __tenantBlocked = await rejectIfTenantBlocksLegacyOperationalApi(request);
  if (__tenantBlocked) return __tenantBlocked;
  const auth = resolveIntegrationEmpresa(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
  }

  try {
    const grupo = await getGrupoAutorizadoForEmpresa(auth.empresaId, id);
    const cotasAtivas = await listCotasAutorizadasForEmpresa(auth.empresaId, id);

    return NextResponse.json(
      {
        success: true,
        api_version: "1",
        grupo,
        cotas: cotasAtivas,
        cotas_total: cotasAtivas.length,
        cotas_ativas: cotasAtivas.length,
        synced_at: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    if (isGrupoNotFoundError(err)) {
      return NextResponse.json({ error: GRUPO_NOT_FOUND_MESSAGE }, { status: 404 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao buscar grupo" },
      { status: 500 },
    );
  }
}
