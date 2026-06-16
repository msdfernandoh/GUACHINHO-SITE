import { NextResponse } from "next/server";
import { getIndicesPublicos } from "@/lib/indices-financeiros";
import { registrarEvento } from "@/lib/eventos/registrar";

export async function GET() {
  try {
    const { indices, refreshErrors } = await getIndicesPublicos({ tentarAtualizarAutomaticos: false });

    await registrarEvento({
      tipo_evento: "indice_financeiro_consultado",
      origem: "api_public_indices",
      pagina: "/api/public/indices-financeiros",
      dados_evento: { quantidade: indices.length, erros: refreshErrors.length },
    });

    return NextResponse.json({
      ok: true,
      indices,
      refreshErrors,
      atualizadoEm: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao carregar índices";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
