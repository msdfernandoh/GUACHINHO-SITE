import { NextResponse } from "next/server";
import { rejectIfTenantBlocksLegacyOperationalApi } from "@/lib/tenant/assert-legacy-operational-api";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canCreateProposta } from "@/lib/auth/permissions";
import { criarContratacaoOnline } from "@/lib/contratacoes-online/service";
import type { IniciarContratacaoBody } from "@/lib/contratacoes-online/types";
import { buildPropostaPublicUrl } from "@/lib/url/public-url";
import { DEFAULT_SITE, getConfigJsonPublic } from "@/server/config";
import {
  GRUPO_NOT_FOUND_MESSAGE,
  isGrupoNotFoundError,
} from "@/lib/grupos/catalogo-autorizado";
import { assertDadosSimulacaoGruposAutorizadosForEmpresa } from "@/lib/grupos/catalogo-autorizado-service";
import { getCatalogEmpresaIdFromRequest } from "@/lib/grupos/resolve-catalog-empresa";

export async function POST(request: Request) {
  const __tenantBlocked = await rejectIfTenantBlocksLegacyOperationalApi(request);
  if (__tenantBlocked) return __tenantBlocked;
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

    // Cliente no site: mantém toda a proposta apenas no navegador até concluir
    // nome, contato, CPF/CNPJ e endereço. Evita simulações incompletas no banco.
    if (body.origem === "grupos" && body.modo === "sdr_link") {
      const empresaId = await getCatalogEmpresaIdFromRequest(request);
      if (!empresaId) {
        return NextResponse.json({ error: GRUPO_NOT_FOUND_MESSAGE }, { status: 404 });
      }
      try {
        await assertDadosSimulacaoGruposAutorizadosForEmpresa(
          empresaId,
          body.dados_simulacao as Record<string, unknown>,
        );
      } catch (err) {
        if (isGrupoNotFoundError(err)) {
          return NextResponse.json({ error: GRUPO_NOT_FOUND_MESSAGE }, { status: 404 });
        }
        throw err;
      }
    }

    if (body.modo === "cliente_site") {
      const consultorId = body.consultor_id?.trim() || usuario?.id || "";
      if (!consultorId) {
        return NextResponse.json(
          { error: "Selecione o consultor responsável pela proposta." },
          { status: 400 },
        );
      }
      return NextResponse.json({
        ok: true,
        draft: true,
        path: "/proposta/rascunho",
        draftPayload: {
          modo: body.modo,
          origem: body.origem,
          dados_simulacao: body.dados_simulacao,
          createdAt: new Date().toISOString(),
          consultor_id: body.consultor_id?.trim() || usuario?.id || undefined,
          consultor_nome: body.consultor_nome?.trim() || usuario?.nome || undefined,
          cliente_pre_nome: body.cliente_pre_nome?.trim() || undefined,
          cliente_pre_telefone: body.cliente_pre_telefone?.trim() || undefined,
          cliente_pre_email: body.cliente_pre_email?.trim() || undefined,
        },
      });
    }

    const { row, publicPath } = await criarContratacaoOnline(body, usuario);
    const site = await getConfigJsonPublic("site", DEFAULT_SITE);
    const url = buildPropostaPublicUrl(row.public_token, site.siteUrl || undefined);

    return NextResponse.json({
      ok: true,
      draft: false,
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
