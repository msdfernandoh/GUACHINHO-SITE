import { NextResponse } from "next/server";
import { getResumoExecutivo } from "@/lib/gestao/dashboards-service";
import { gestaoApiMessage, gestaoApiStatus, requireGestaoApiAccess } from "@/lib/gestao/api-access";

export async function GET() {
  try {
    const { empresaId } = await requireGestaoApiAccess("read");
    const data = await getResumoExecutivo(empresaId);
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: unknown) {
    return NextResponse.json({ error: gestaoApiMessage(error) }, { status: gestaoApiStatus(error) });
  }
}
