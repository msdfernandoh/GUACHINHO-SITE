import { NextResponse } from "next/server";
import { registrarEvento } from "@/lib/eventos/registrar";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      tipo_evento: string;
      origem?: string;
      entidade_tipo?: string;
      entidade_id?: string;
      lead_id?: string;
    };
    if (!body.tipo_evento) {
      return NextResponse.json({ error: "tipo_evento obrigatório" }, { status: 400 });
    }
    await registrarEvento({
      tipo_evento: body.tipo_evento,
      origem: body.origem ?? "client",
      entidade_tipo: body.entidade_tipo,
      entidade_id: body.entidade_id,
      lead_id: body.lead_id,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
