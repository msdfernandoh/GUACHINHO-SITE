import { NextResponse } from "next/server";
import { resumoFinanceiroFromDados, linhasGrupoResumoFromDados } from "@/lib/contratacoes-online/extract-fields";
import { getConfigJsonPublic } from "@/server/config";
import {
  DEFAULT_CONTRATACAO_ONLINE_CONFIG,
  formasPagamentoDisponiveis,
} from "@/lib/contratacoes-online/pagamento";
import { isContratacaoDraftPayload } from "@/lib/contratacoes-online/draft";
import { extrairCamposFlat } from "@/lib/contratacoes-online/extract-fields";

/** Preview do rascunho sem gravar no banco. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    if (!isContratacaoDraftPayload(body)) {
      return NextResponse.json({ error: "Rascunho inválido" }, { status: 400 });
    }
    const cfg = await getConfigJsonPublic(
      "contratacao_online_config",
      DEFAULT_CONTRATACAO_ONLINE_CONFIG,
    );
    const flat = extrairCamposFlat(body.origem, body.dados_simulacao);
    return NextResponse.json({
      ok: true,
      contratacao: {
        id: null,
        public_token: null,
        protocolo: "RASCUNHO",
        origem: body.origem,
        status: "proposta_aberta",
        nome: null,
        telefone: null,
        email: null,
        ...flat,
        dados_simulacao: {
          ...body.dados_simulacao,
          origem_fluxo: body.origem,
          modo: body.modo,
        },
        forma_pagamento: null,
        rascunho: true,
      },
      resumoFinanceiro: resumoFinanceiroFromDados(body.origem, body.dados_simulacao),
      gruposLinhas: linhasGrupoResumoFromDados(body.origem, body.dados_simulacao),
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
