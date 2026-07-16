import { NextResponse } from "next/server";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { criarContratacaoOnline, atualizarContratacaoPublica } from "@/lib/contratacoes-online/service";
import { isContratacaoDraftPayload } from "@/lib/contratacoes-online/draft";
import { sanitizeContratacaoPublica } from "@/lib/contratacoes-online/sanitize-public";
import { buildPropostaPublicUrl } from "@/lib/url/public-url";
import { DEFAULT_SITE, getConfigJsonPublic } from "@/server/config";

/**
 * Grava a contratação no banco somente quando o cliente informa nome/telefone
 * (saída do rascunho da tela inicial).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      draft?: unknown;
      nome?: string;
      telefone?: string;
      email?: string;
    };
    if (!isContratacaoDraftPayload(body.draft)) {
      return NextResponse.json({ error: "Rascunho inválido" }, { status: 400 });
    }
    const nome = body.nome?.trim() ?? "";
    if (!nome) {
      return NextResponse.json({ error: "Informe o nome do cliente para gravar a contratação." }, { status: 400 });
    }

    const usuario = await getUsuarioNegocio();
    const { row, publicPath } = await criarContratacaoOnline(
      {
        modo: body.draft.modo,
        origem: body.draft.origem,
        dados_simulacao: body.draft.dados_simulacao,
        cliente_pre_nome: nome,
        cliente_pre_telefone: body.telefone,
        cliente_pre_email: body.email,
      },
      usuario,
    );

    // Avança para dados preenchidos (confirma + dados em um passo a partir do rascunho)
    const updated = await atualizarContratacaoPublica(row.public_token, {
      etapa: "dados",
      nome,
      telefone: body.telefone,
      email: body.email,
    });

    const site = await getConfigJsonPublic("site", DEFAULT_SITE);
    const url = buildPropostaPublicUrl(updated.public_token, site.siteUrl || undefined);

    return NextResponse.json({
      ok: true,
      public_token: updated.public_token,
      protocolo: updated.protocolo,
      path: publicPath,
      url,
      contratacao: sanitizeContratacaoPublica(updated),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}