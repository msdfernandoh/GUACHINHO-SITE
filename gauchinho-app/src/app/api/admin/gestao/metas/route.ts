import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listMetasForEmpresa, createMeta } from "@/lib/gestao/metas-service";
import { assertSameOrigin, gestaoApiMessage, gestaoApiStatus, requireGestaoApiAccess } from "@/lib/gestao/api-access";

const metaSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  alvo_tipo: z.enum(["empresa", "equipe", "participante", "parceiro"]),
  alvo_id: z.uuid().optional(),
  indicador: z.enum(["valor_credito_vendido", "quantidade_vendas", "propostas_criadas", "receita_prevista_franquia", "receita_recebida"]),
  periodo_tipo: z.enum(["mensal", "trimestral", "anual", "personalizado"]),
  data_inicio: z.iso.date(),
  data_fim: z.iso.date(),
  valor_meta: z.number().finite().nonnegative(),
  observacoes: z.string().trim().max(4000).optional(),
}).strict().refine((data) => data.data_fim >= data.data_inicio, {
  message: "data_fim deve ser igual ou posterior a data_inicio",
  path: ["data_fim"],
});

export async function GET() {
  try {
    const { empresaId } = await requireGestaoApiAccess("read");
    const data = await listMetasForEmpresa(empresaId);
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: unknown) {
    return NextResponse.json({ error: gestaoApiMessage(error) }, { status: gestaoApiStatus(error) });
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const { empresaId } = await requireGestaoApiAccess("write");
    const body = metaSchema.parse(await req.json());
    const data = await createMeta(empresaId, body);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const status = error instanceof z.ZodError ? 400 : gestaoApiStatus(error);
    return NextResponse.json({ error: error instanceof z.ZodError ? "Dados inválidos." : gestaoApiMessage(error) }, { status });
  }
}
