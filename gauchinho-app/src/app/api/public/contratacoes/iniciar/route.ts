import { NextResponse } from "next/server";
import { rejectIfTenantBlocksLegacyOperationalApi } from "@/lib/tenant/assert-legacy-operational-api";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canCreateProposta } from "@/lib/auth/permissions";
import type { IniciarContratacaoBody } from "@/lib/contratacoes-online/types";
import {
  CotaNotFoundError,
  GRUPO_NOT_FOUND_MESSAGE,
  isGrupoNotFoundError,
} from "@/lib/grupos/catalogo-autorizado";
import { assertDadosSimulacaoGruposAutorizadosForEmpresa } from "@/lib/grupos/catalogo-autorizado-service";
import { getCatalogEmpresaIdFromRequest } from "@/lib/grupos/resolve-catalog-empresa";
import { criarContratacaoDraftLink } from "@/lib/contratacoes-online/draft-link";

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

    // Cliente no site: mantém o início vazio no navegador. A proposta só nasce
    // quando nome + telefone válidos forem enviados pelo wizard.
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
        if (isGrupoNotFoundError(err) || err instanceof CotaNotFoundError) {
          return NextResponse.json({ error: GRUPO_NOT_FOUND_MESSAGE }, { status: 404 });
        }
        throw err;
      }
    }

    if (body.modo === "cliente_site" || body.modo === "sdr_link") {
      const consultorId = body.consultor_id?.trim() || usuario?.id || "";
      if (!consultorId) {
        return NextResponse.json(
          { error: "Selecione o consultor responsável pela proposta." },
          { status: 400 },
        );
      }
      const draftPayload = {
        modo: body.modo,
        origem: body.origem,
        dados_simulacao: body.dados_simulacao,
        createdAt: new Date().toISOString(),
        consultor_id: body.consultor_id?.trim() || usuario?.id || undefined,
        consultor_nome: body.consultor_nome?.trim() || usuario?.nome || undefined,
        cliente_pre_nome: body.cliente_pre_nome?.trim() || undefined,
        cliente_pre_telefone: body.cliente_pre_telefone?.trim() || undefined,
        cliente_pre_email: body.cliente_pre_email?.trim() || undefined,
      };
      return NextResponse.json({
        ok: true,
        draft: true,
        path: "/proposta/rascunho",
        url: body.modo === "sdr_link" ? criarContratacaoDraftLink(draftPayload, new URL(request.url).origin) : undefined,
        draftPayload,
      });
    }
    return NextResponse.json({ error: "Modo inválido" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
