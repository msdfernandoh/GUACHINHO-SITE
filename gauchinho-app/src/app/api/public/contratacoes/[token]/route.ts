import { NextResponse } from "next/server";
import {
  buscarContratacaoPorToken,
  confirmarProposta,
  marcarPrimeiroAcesso,
  atualizarContratacaoPublica,
} from "@/lib/contratacoes-online/service";
import { isValidPublicToken } from "@/lib/contratacoes-online/public-token";
import { resumoFinanceiroFromDados, linhasGrupoResumoFromDados } from "@/lib/contratacoes-online/extract-fields";
import { getConfigJsonPublic } from "@/server/config";
import {
  DEFAULT_CONTRATACAO_ONLINE_CONFIG,
  formasPagamentoDisponiveis,
} from "@/lib/contratacoes-online/pagamento";
import type { PatchContratacaoPublica } from "@/lib/contratacoes-online/service";
import {
  sanitizeContratacaoPublica,
} from "@/lib/contratacoes-online/sanitize-public";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    if (!isValidPublicToken(token)) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 });
    }
    let row = await buscarContratacaoPorToken(token);
    if (!row) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
    row = await marcarPrimeiroAcesso(row);
    const cfg = await getConfigJsonPublic(
      "contratacao_online_config",
      DEFAULT_CONTRATACAO_ONLINE_CONFIG,
    );
    const dadosSim = (row.dados_simulacao ?? {}) as Record<string, unknown>;
    return NextResponse.json({
      ok: true,
      contratacao: sanitizeContratacaoPublica(row),
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
  try {
    const { token } = await ctx.params;
    if (!isValidPublicToken(token)) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 });
    }
    const body = (await request.json()) as PatchContratacaoPublica & { acao?: string };
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
