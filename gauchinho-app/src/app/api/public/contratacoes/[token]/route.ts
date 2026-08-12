import { NextResponse } from "next/server";
import { rejectIfTenantBlocksLegacyOperationalApi } from "@/lib/tenant/assert-legacy-operational-api";
import {
  buscarContratacaoPorToken,
  confirmarProposta,
  marcarPrimeiroAcesso,
  atualizarContratacaoPublica,
} from "@/lib/contratacoes-online/service";
import { isValidPublicToken } from "@/lib/contratacoes-online/public-token";
import {
  extrairCamposFlat,
  resumoFinanceiroFromDados,
  linhasGrupoResumoFromDados,
} from "@/lib/contratacoes-online/extract-fields";
import { getConfigJsonPublic } from "@/server/config";
import {
  DEFAULT_CONTRATACAO_ONLINE_CONFIG,
  formasPagamentoDisponiveis,
} from "@/lib/contratacoes-online/pagamento";
import type { PatchContratacaoPublica } from "@/lib/contratacoes-online/service";
import {
  sanitizeContratacaoPublica,
} from "@/lib/contratacoes-online/sanitize-public";
import { atualizarFluxoProposta, buscarFluxoProposta } from "@/lib/contratacoes-online/proposta-flow";
import { getCatalogEmpresaIdFromRequest } from "@/lib/grupos/resolve-catalog-empresa";

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
    if (!empresaId) return NextResponse.json({ error: "Tenant não identificado." }, { status: 404 });
    let row = await buscarFluxoProposta(token, empresaId);
    const proposalFlow = Boolean(row);
    if (!row) row = await buscarContratacaoPorToken(token);
    if (!row) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
    if (!proposalFlow && row.empresa_id !== empresaId) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
    if (!proposalFlow) row = await marcarPrimeiroAcesso(row);
    const cfg = await getConfigJsonPublic(
      "contratacao_online_config",
      DEFAULT_CONTRATACAO_ONLINE_CONFIG,
    );
    const dadosSim = (row.dados_simulacao ?? {}) as Record<string, unknown>;
    const flatAtualizado = extrairCamposFlat(row.origem, dadosSim);
    return NextResponse.json({
      ok: true,
      // Recalcula também links já gerados antes da correção dos totais multigrupo.
      contratacao: sanitizeContratacaoPublica({ ...row, ...flatAtualizado }),
      resumoFinanceiro: resumoFinanceiroFromDados(row.origem, dadosSim),
      gruposLinhas: linhasGrupoResumoFromDados(row.origem, dadosSim),
      formasPagamento: formasPagamentoDisponiveis(cfg),
      pixConfig: cfg.pix_primeira_parcela_ativo
        ? {
            chave: cfg.pix_chave,
            recebedor: cfg.pix_recebedor,
            instrucoes: cfg.pix_instrucoes,
            comprovanteObrigatorio: cfg.comprovante_pix_obrigatorio,
          }
        : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  const __tenantBlocked = await rejectIfTenantBlocksLegacyOperationalApi(request);
  if (__tenantBlocked) return __tenantBlocked;
  try {
    const { token } = await ctx.params;
    if (!isValidPublicToken(token)) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 });
    }
    const empresaId = await getCatalogEmpresaIdFromRequest(request);
    if (!empresaId) return NextResponse.json({ error: "Tenant não identificado." }, { status: 404 });
    const body = (await request.json()) as PatchContratacaoPublica & { acao?: string };
    const proposal = await buscarFluxoProposta(token, empresaId);
    if (proposal) {
      const row = await atualizarFluxoProposta(token, empresaId, body);
      return NextResponse.json({ ok: true, contratacao: sanitizeContratacaoPublica(row) });
    }
    const legacy = await buscarContratacaoPorToken(token);
    if (!legacy || legacy.empresa_id !== empresaId) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
    if (body.acao === "confirmar") {
      const row = await confirmarProposta(token);
      return NextResponse.json({ ok: true, contratacao: sanitizeContratacaoPublica(row) });
    }
    const row = await atualizarContratacaoPublica(token, body);
    return NextResponse.json({ ok: true, contratacao: sanitizeContratacaoPublica(row) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
