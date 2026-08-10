import { NextResponse } from "next/server";
import { getResumoExecutivo } from "@/lib/gestao/dashboards-service";

const GAUCHINHO_EMPRESA_ID = "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";

export async function GET() {
  try {
    const data = await getResumoExecutivo(GAUCHINHO_EMPRESA_ID);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
