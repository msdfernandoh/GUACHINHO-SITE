import { NextResponse } from "next/server";
import { rejectIfTenantBlocksLegacyOperationalApi } from "@/lib/tenant/assert-legacy-operational-api";
import { isValidPublicToken } from "@/lib/contratacoes-online/public-token";
import { getCatalogEmpresaIdFromRequest } from "@/lib/grupos/resolve-catalog-empresa";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPropostaPdfDownloadUrl } from "@/lib/proposta/generate-pdf";
import { registrarEvento } from "@/lib/eventos/registrar";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const __tenantBlocked = await rejectIfTenantBlocksLegacyOperationalApi(request);
  if (__tenantBlocked) return __tenantBlocked;

  try {
    const { token } = await ctx.params;
    if (!isValidPublicToken(token)) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 });
    }

    const empresaId = await getCatalogEmpresaIdFromRequest(request);
    if (!empresaId) {
      return NextResponse.json({ error: "Tenant não identificado." }, { status: 404 });
    }

    const admin = createAdminClient();

    // 1. Localiza a proposta pelo public_token
    let propostaId: string | null = null;

    const { data: prop } = await admin
      .from("propostas")
      .select("id, empresa_id, status")
      .eq("public_token", token)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (prop) {
      propostaId = prop.id;
    } else {
      // 2. Fallback: verifica se é uma contratação online cujo public_token aponta para uma proposta
      const { data: contr } = await admin
        .from("contratacoes_online")
        .select("id, proposta_id, empresa_id")
        .eq("public_token", token)
        .eq("empresa_id", empresaId)
        .maybeSingle();

      if (contr?.proposta_id) {
        propostaId = contr.proposta_id;
      }
    }

    if (!propostaId) {
      return NextResponse.json({ error: "Proposta não encontrada para este link." }, { status: 404 });
    }

    // 3. Obtém ou gera sob demanda a URL assinada do PDF
    const downloadUrl = await getPropostaPdfDownloadUrl(propostaId);

    await registrarEvento({
      tipo_evento: "proposta_pdf_baixada",
      origem: "publico_link",
      entidade_tipo: "proposta",
      entidade_id: propostaId,
      pagina: "/api/public/contratacoes/pdf",
    });

    const url = new URL(request.url);
    if (url.searchParams.get("format") === "json") {
      return NextResponse.json({ ok: true, downloadUrl });
    }

    return NextResponse.redirect(downloadUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao obter PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
