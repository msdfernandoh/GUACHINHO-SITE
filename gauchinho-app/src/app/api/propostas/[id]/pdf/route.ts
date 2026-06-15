import { NextResponse } from "next/server";
import { getPropostaPdfDownloadUrl } from "@/lib/proposta/generate-pdf";
import { registrarEvento } from "@/lib/eventos/registrar";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const url = await getPropostaPdfDownloadUrl(id);
    await registrarEvento({
      tipo_evento: "proposta_pdf_baixada",
      origem: "publico",
      entidade_tipo: "proposta",
      entidade_id: id,
      pagina: "/api/propostas/pdf",
    });
    return NextResponse.redirect(url);
  } catch (e) {
    const message = e instanceof Error ? e.message : "PDF indisponível";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
