import { NextResponse } from "next/server";
import { rejectIfTenantBlocksLegacyOperationalApi } from "@/lib/tenant/assert-legacy-operational-api";
import { uploadDocumentoContratacao, buscarContratacaoPorToken, listarDocumentos } from "@/lib/contratacoes-online/service";
import { isValidPublicToken } from "@/lib/contratacoes-online/public-token";
import type { TipoDocumentoContratacao } from "@/lib/contratacoes-online/types";
import { sanitizeDocumentosPublicos } from "@/lib/contratacoes-online/sanitize-public";
import { buscarFluxoProposta, listarDocumentosProposta, uploadDocumentoProposta } from "@/lib/contratacoes-online/proposta-flow";
import { getCatalogEmpresaIdFromRequest } from "@/lib/grupos/resolve-catalog-empresa";

type Ctx = { params: Promise<{ token: string }> };

const TIPOS: TipoDocumentoContratacao[] = [
  "documento_foto",
  "cpf",
  "cartao_cnpj",
  "documento_responsavel",
  "cpf_responsavel",
  "comprovante_endereco",
  "comprovante_pix",
  "outro",
];

export async function GET(request: Request, ctx: Ctx) {
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
    const row = proposal ?? await buscarContratacaoPorToken(token);
    if (!row) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
    if (!proposal && row.empresa_id !== empresaId) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
    try {
      const proposalDocs = proposal ? await listarDocumentosProposta(token, empresaId) : null;
      const documentosRaw = proposalDocs ?? await listarDocumentos(row.id);
      return NextResponse.json({
        ok: true,
        documentos: sanitizeDocumentosPublicos(documentosRaw),
      });
    } catch {
      return NextResponse.json({ ok: true, documentos: [] });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
    const form = await request.formData();
    const tipo = String(form.get("tipo_documento") ?? "") as TipoDocumentoContratacao;
    const file = form.get("arquivo");
    if (!TIPOS.includes(tipo)) {
      return NextResponse.json({ error: "Tipo de documento inválido" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });
    }
    const proposal = await buscarFluxoProposta(token, empresaId);
    if (!proposal) {
      const legacy = await buscarContratacaoPorToken(token);
      if (!legacy || legacy.empresa_id !== empresaId) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
    }
    const result = proposal
      ? await uploadDocumentoProposta(token, empresaId, tipo, file)
      : await uploadDocumentoContratacao(token, tipo, file);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
