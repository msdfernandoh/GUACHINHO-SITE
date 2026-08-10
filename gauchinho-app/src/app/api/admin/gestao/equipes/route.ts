import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listEquipesForEmpresa, createEquipe } from "@/lib/gestao/equipes-service";
import { assertSameOrigin, gestaoApiMessage, gestaoApiStatus, requireGestaoApiAccess } from "@/lib/gestao/api-access";

const equipeSchema = z.object({
  nome: z.string().trim().min(1).max(160),
  descricao: z.string().trim().max(2000).optional(),
  gestor_id: z.uuid().optional(),
  status: z.enum(["ativa", "inativa"]).optional(),
}).strict();

export async function GET() {
  try {
    const { empresaId } = await requireGestaoApiAccess("read");
    const data = await listEquipesForEmpresa(empresaId);
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: unknown) {
    return NextResponse.json({ error: gestaoApiMessage(error) }, { status: gestaoApiStatus(error) });
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const { empresaId } = await requireGestaoApiAccess("write");
    const body = equipeSchema.parse(await req.json());
    const data = await createEquipe(empresaId, body);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const status = error instanceof z.ZodError ? 400 : gestaoApiStatus(error);
    return NextResponse.json({ error: error instanceof z.ZodError ? "Dados inválidos." : gestaoApiMessage(error) }, { status });
  }
}
