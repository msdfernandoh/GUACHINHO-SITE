import { NextResponse } from "next/server";
import { rejectIfTenantBlocksLegacyOperationalApi } from "@/lib/tenant/assert-legacy-operational-api";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageGruposSorteios } from "@/lib/auth/permissions";
import { DEFAULT_LEADS, getConfigJson } from "@/server/config";
import { buscarPrimeiroPremioFederalPorData } from "@/lib/grupos-sorteio/buscar-resultado-federal";

export const maxDuration = 60;

export async function GET(request: Request) {
  const __tenantBlocked = await rejectIfTenantBlocksLegacyOperationalApi(request);
  if (__tenantBlocked) return __tenantBlocked;
  const usuario = await getUsuarioNegocio();
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const leadsConfig = await getConfigJson("leads", DEFAULT_LEADS);
  if (!canManageGruposSorteios(usuario.perfil, leadsConfig.srdPodeEditarGrupos)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const data = new URL(request.url).searchParams.get("data")?.trim() ?? "";
  const result = await buscarPrimeiroPremioFederalPorData(data);
  return NextResponse.json(result);
}
