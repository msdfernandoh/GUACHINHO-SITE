import { NextResponse } from "next/server";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageImobiliarias } from "@/lib/auth/permissions";
import { fetchNpsDashboard } from "@/lib/eventos-sorteio/nps-dashboard";
import { npsDashboardToXlsBody } from "@/lib/eventos-sorteio/nps-export";
import { renderNpsExportPdfBuffer } from "@/lib/eventos-sorteio/nps-pdf-document";
import { slugify } from "@/lib/utils/slug";

export async function GET(request: Request) {
  const usuario = await getUsuarioNegocio();
  if (!usuario || !canManageImobiliarias(usuario.perfil)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const sp = new URL(request.url).searchParams;
  const eventoId = sp.get("evento_id")?.trim();
  const format = sp.get("format") === "pdf" ? "pdf" : "xls";

  if (!eventoId) {
    return NextResponse.json({ error: "Informe evento_id" }, { status: 400 });
  }

  let data;
  try {
    data = await fetchNpsDashboard(eventoId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  }

  const slug = slugify(data.eventoNome) || "evento";
  const date = new Date().toISOString().slice(0, 10);
  const baseName = `nps-${slug}-${date}`;

  if (format === "pdf") {
    const pdf = await renderNpsExportPdfBuffer(data);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
      },
    });
  }

  const xls = npsDashboardToXlsBody(data);
  return new NextResponse(xls, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseName}.xls"`,
    },
  });
}
