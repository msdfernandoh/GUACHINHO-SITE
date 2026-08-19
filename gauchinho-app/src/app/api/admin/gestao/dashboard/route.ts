import { NextRequest, NextResponse } from "next/server";
import { getErpDashboardCompleto, type ErpDashboardFiltros } from "@/lib/gestao/dashboards-service";
import { gestaoApiMessage, gestaoApiStatus, requireGestaoApiAccess } from "@/lib/gestao/api-access";

export async function GET(request: NextRequest) {
  try {
    const { empresaId } = await requireGestaoApiAccess("read");
    const { searchParams } = new URL(request.url);

    const filtros: ErpDashboardFiltros = {
      periodo: (searchParams.get("periodo") as any) || "mes_atual",
      administradoraId: searchParams.get("administradoraId") || undefined,
      mesCompetencia: searchParams.get("mesCompetencia") || undefined,
      dataInicio: searchParams.get("dataInicio") || undefined,
      dataFim: searchParams.get("dataFim") || undefined,
    };

    const data = await getErpDashboardCompleto(empresaId, filtros);
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: unknown) {
    return NextResponse.json({ error: gestaoApiMessage(error) }, { status: gestaoApiStatus(error) });
  }
}

