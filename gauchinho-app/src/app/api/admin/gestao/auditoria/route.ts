import { NextRequest, NextResponse } from "next/server";
import { listAuditLogsForEmpresa } from "@/lib/gestao/auditoria-service";
import { gestaoApiMessage, gestaoApiStatus, requireGestaoApiAccess } from "@/lib/gestao/api-access";

export async function GET(req: NextRequest) {
  try {
    const { empresaId } = await requireGestaoApiAccess("read");
    const { searchParams } = new URL(req.url);
    const modulo = searchParams.get("modulo") || undefined;
    const data = await listAuditLogsForEmpresa(empresaId, { modulo });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: unknown) {
    return NextResponse.json({ error: gestaoApiMessage(error) }, { status: gestaoApiStatus(error) });
  }
}
