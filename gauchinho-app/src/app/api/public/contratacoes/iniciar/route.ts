import { NextResponse } from "next/server";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canCreateProposta } from "@/lib/auth/permissions";
import { criarContratacaoOnline } from "@/lib/contratacoes-online/service";
import type { IniciarContratacaoBody } from "@/lib/contratacoes-online/types";
import { buildPropostaPublicUrl } from "@/lib/url/public-url";
import { DEFAULT_SITE, getConfigJsonPublic } from "@/server/config";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as IniciarContratacaoBody;
    if (!body.origem || !body.modo || !body.dados_simulacao) {
      return NextResponse.json({ error: "Payload incompleto" }, { status: 400 });
    }
    if (body.origem !== "simulador" && body.origem !== "grupos") {
      return NextResponse.json({ error: "Origem inválida" }, { status: 400 });
    }
    if (body.modo !== "cliente_site" && body.modo !== "sdr_link") {
      return NextResponse.json({ error: "Modo inválido" }, { status: 400 });
    }

    const usuario = await getUsuarioNegocio();
    if (body.modo === "sdr_link") {
      if (!usuario || !canCreateProposta(usuario.perfil)) {
        return NextResponse.json({ error: "Sem permissão para gerar link" }, { status: 403 });
      }
    }

    const { row, publicPath } = await criarContratacaoOnline(body, usuario);
    const site = await getConfigJsonPublic("site", DEFAULT_SITE);
    const url = buildPropostaPublicUrl(row.public_token, site.siteUrl || undefined);

    return NextResponse.json({
      ok: true,
      public_token: row.public_token,
      protocolo: row.protocolo,
      url,
      path: publicPath,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
