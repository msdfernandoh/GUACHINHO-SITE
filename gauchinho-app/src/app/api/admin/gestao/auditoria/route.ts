import { NextRequest, NextResponse } from "next/server";
import { listAuditLogsForEmpresa } from "@/lib/gestao/auditoria-service";

const GAUCHINHO_EMPRESA_ID = "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const modulo = searchParams.get("modulo") || undefined;
    const data = await listAuditLogsForEmpresa(GAUCHINHO_EMPRESA_ID, { modulo });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
