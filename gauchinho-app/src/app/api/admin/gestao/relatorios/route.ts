import { NextResponse } from "next/server";
import { getResumoComercial, getResumoFinanceiroDash } from "@/lib/gestao/dashboards-service";
import { gestaoApiMessage, gestaoApiStatus, requireGestaoApiAccess } from "@/lib/gestao/api-access";

export async function GET() {
  try {
    const { empresaId } = await requireGestaoApiAccess("read");
    const comercial = await getResumoComercial(empresaId);
    const financeiro = await getResumoFinanceiroDash(empresaId);
    return NextResponse.json({ comercial, financeiro }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: unknown) {
    return NextResponse.json({ error: gestaoApiMessage(error) }, { status: gestaoApiStatus(error) });
  }
}
