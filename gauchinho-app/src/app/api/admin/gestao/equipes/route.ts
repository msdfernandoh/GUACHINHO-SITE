import { NextRequest, NextResponse } from "next/server";
import { listEquipesForEmpresa, createEquipe } from "@/lib/gestao/equipes-service";

const GAUCHINHO_EMPRESA_ID = "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";

export async function GET() {
  try {
    const data = await listEquipesForEmpresa(GAUCHINHO_EMPRESA_ID);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await createEquipe(GAUCHINHO_EMPRESA_ID, body);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
