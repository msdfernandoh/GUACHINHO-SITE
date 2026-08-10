import { NextResponse } from "next/server";
import { getResumoComercial, getResumoFinanceiroDash } from "@/lib/gestao/dashboards-service";

const GAUCHINHO_EMPRESA_ID = "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";

export async function GET() {
  try {
    const comercial = await getResumoComercial(GAUCHINHO_EMPRESA_ID);
    const financeiro = await getResumoFinanceiroDash(GAUCHINHO_EMPRESA_ID);
    return NextResponse.json({ comercial, financeiro });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
