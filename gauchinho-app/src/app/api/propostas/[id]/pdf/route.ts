import { NextResponse } from "next/server";
import { rejectIfTenantBlocksLegacyOperationalApi } from "@/lib/tenant/assert-legacy-operational-api";
import { getPropostaPdfDownloadUrl } from "@/lib/proposta/generate-pdf";
import { assertPropostaPdfPublicAccess } from "@/lib/proposta/pdf-public-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarEvento } from "@/lib/eventos/registrar";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const __tenantBlocked = await rejectIfTenantBlocksLegacyOperationalApi(request);
  if (__tenantBlocked) return __tenantBlocked;

  try {
    const { id } = await context.params;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "PDF indisponível" }, { status: 404 });
    }

    const token = new URL(request.url).searchParams.get("t");
    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("propostas")
      .select("id, pdf_url, empresa_id, organizacao_parceira_id, participant_id")
      .eq("id", id)
      .maybeSingle();

    if (error || !row) {
      return NextResponse.json({ error: "PDF indisponível" }, { status: 404 });
    }

    const gate = assertPropostaPdfPublicAccess({
      propostaId: id,
      token,
      row,
    });
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    const url = await getPropostaPdfDownloadUrl(id);
    await registrarEvento({
      tipo_evento: "proposta_pdf_baixada",
      origem: "publico",
      entidade_tipo: "proposta",
      entidade_id: id,
      pagina: "/api/propostas/pdf",
    });
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.json({ error: "PDF indisponível" }, { status: 404 });
  }
}
