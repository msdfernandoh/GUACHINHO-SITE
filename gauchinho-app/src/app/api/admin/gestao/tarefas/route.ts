import { NextRequest, NextResponse } from "next/server";
import { listTarefasForEmpresa, createTarefa, updateTarefaStatus } from "@/lib/gestao/tarefas-service";

const GAUCHINHO_EMPRESA_ID = "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";

export async function GET() {
  try {
    const data = await listTarefasForEmpresa(GAUCHINHO_EMPRESA_ID);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await createTarefa(GAUCHINHO_EMPRESA_ID, body);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await updateTarefaStatus(GAUCHINHO_EMPRESA_ID, body.id, body.status);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
