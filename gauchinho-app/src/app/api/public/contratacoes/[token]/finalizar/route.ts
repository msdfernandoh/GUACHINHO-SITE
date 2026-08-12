import { NextResponse } from "next/server";
import { rejectIfTenantBlocksLegacyOperationalApi } from "@/lib/tenant/assert-legacy-operational-api";
import { buscarContratacaoPorToken, finalizarContratacao } from "@/lib/contratacoes-online/service";
import { buscarFluxoProposta, finalizarPropostaEmContratacao } from "@/lib/contratacoes-online/proposta-flow";
import { getCatalogEmpresaIdFromRequest } from "@/lib/grupos/resolve-catalog-empresa";
import { isValidPublicToken } from "@/lib/contratacoes-online/public-token";

type Ctx = { params: Promise<{ token: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const __tenantBlocked = await rejectIfTenantBlocksLegacyOperationalApi(request);
  if (__tenantBlocked) return __tenantBlocked;
  try {
    const { token } = await ctx.params;
    if (!isValidPublicToken(token)) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 });
    }
    const empresaId = await getCatalogEmpresaIdFromRequest(request);
    if (!empresaId) return NextResponse.json({ error: "Tenant não identificado." }, { status: 404 });
    const proposal = await buscarFluxoProposta(token, empresaId);
    let row;
    if (proposal) {
      row = await finalizarPropostaEmContratacao(token, empresaId);
    } else {
      const legacy = await buscarContratacaoPorToken(token);
      if (!legacy || legacy.empresa_id !== empresaId) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
      row = await finalizarContratacao(token);
    }
    return NextResponse.json({ ok: true, contratacao: row });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
