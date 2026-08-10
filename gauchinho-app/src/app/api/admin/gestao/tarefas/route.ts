import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listTarefasForEmpresa, createTarefa, updateTarefaStatus } from "@/lib/gestao/tarefas-service";
import { assertSameOrigin, gestaoApiMessage, gestaoApiStatus, requireGestaoApiAccess } from "@/lib/gestao/api-access";

const tarefaSchema = z.object({
  titulo: z.string().trim().min(1).max(240),
  descricao: z.string().trim().max(4000).optional(),
  responsavel_id: z.uuid().optional(),
  equipe_id: z.uuid().optional(),
  origem_tipo: z.enum(["lead", "proposta", "venda", "participante", "parceiro", "interna"]).optional(),
  origem_id: z.uuid().optional(),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]).optional(),
  data_limite: z.iso.datetime({ offset: true }).optional(),
}).strict();

const tarefaStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["pendente", "em_andamento", "concluida", "cancelada"]),
}).strict();

export async function GET() {
  try {
    const { empresaId } = await requireGestaoApiAccess("read");
    const data = await listTarefasForEmpresa(empresaId);
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: unknown) {
    return NextResponse.json({ error: gestaoApiMessage(error) }, { status: gestaoApiStatus(error) });
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const { empresaId, usuario } = await requireGestaoApiAccess("write");
    const body = tarefaSchema.parse(await req.json());
    const data = await createTarefa(empresaId, { ...body, created_by: usuario.id });
    return NextResponse.json(data);
  } catch (error: unknown) {
    const status = error instanceof z.ZodError ? 400 : gestaoApiStatus(error);
    return NextResponse.json({ error: error instanceof z.ZodError ? "Dados inválidos." : gestaoApiMessage(error) }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const { empresaId } = await requireGestaoApiAccess("write");
    const body = tarefaStatusSchema.parse(await req.json());
    const data = await updateTarefaStatus(empresaId, body.id, body.status);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const status = error instanceof z.ZodError ? 400 : gestaoApiStatus(error);
    return NextResponse.json({ error: error instanceof z.ZodError ? "Dados inválidos." : gestaoApiMessage(error) }, { status });
  }
}
