import { NextResponse } from "next/server";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageGruposSorteios } from "@/lib/auth/permissions";
import { DEFAULT_LEADS, getConfigJson } from "@/server/config";
import { buscarPrimeiroPremioFederalPorData } from "@/lib/grupos-sorteio/buscar-resultado-federal";

export async function GET(request: Request) {
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
