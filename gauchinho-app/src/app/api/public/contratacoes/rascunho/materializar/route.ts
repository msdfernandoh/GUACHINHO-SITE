import { NextResponse } from "next/server";
import { rejectIfTenantBlocksLegacyOperationalApi } from "@/lib/tenant/assert-legacy-operational-api";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { criarContratacaoOnline, atualizarContratacaoPublica } from "@/lib/contratacoes-online/service";
import { isContratacaoDraftPayload } from "@/lib/contratacoes-online/draft";
import { sanitizeContratacaoPublica } from "@/lib/contratacoes-online/sanitize-public";
import { buildPropostaPublicUrl } from "@/lib/url/public-url";
import { DEFAULT_SITE, getConfigJsonPublic } from "@/server/config";
import {
  sanitizeCnpj,
  sanitizeCpf,
  sanitizeTelefone,
  validarCnpj,
  validarCpf,
  validarEmail,
} from "@/lib/contratacoes-online/validacao";
import { parseEnderecoContratacao } from "@/lib/contratacoes-online/endereco";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TipoPessoa } from "@/lib/contratacoes-online/types";
import {
  GRUPO_NOT_FOUND_MESSAGE,
  isGrupoNotFoundError,
} from "@/lib/grupos/catalogo-autorizado";
import { assertDadosSimulacaoGruposAutorizadosForEmpresa } from "@/lib/grupos/catalogo-autorizado-service";
import { getCatalogEmpresaIdFromRequest } from "@/lib/grupos/resolve-catalog-empresa";

/**
 * Materializa o rascunho somente após os dados cadastrais completos.
 * Simulações abandonadas antes de CPF/CNPJ e endereço permanecem apenas no navegador.
 */
export async function POST(request: Request) {
  const __tenantBlocked = await rejectIfTenantBlocksLegacyOperationalApi(request);
  if (__tenantBlocked) return __tenantBlocked;
  let contratacaoCriadaId: string | null = null;
  try {
    const body = (await request.json()) as {
      draft?: unknown;
      nome?: string;
      telefone?: string;
      email?: string;
      tipo_pessoa?: TipoPessoa;
      cpf?: string;
      data_nascimento?: string;
      razao_social?: string;
      cnpj?: string;
      responsavel_nome?: string;
      responsavel_cpf?: string;
      cep?: string;
      endereco?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      cidade?: string;
      uf?: string;
    };
    if (!isContratacaoDraftPayload(body.draft)) {
      return NextResponse.json({ error: "Rascunho inválido" }, { status: 400 });
    }
    const nome = body.nome?.trim() ?? "";
    const telefone = sanitizeTelefone(body.telefone ?? "");
    const email = body.email?.trim() ?? "";
    if (!nome || telefone.length < 10) {
      return NextResponse.json(
        { error: "Nome e telefone/WhatsApp são obrigatórios." },
        { status: 400 },
      );
    }
    if (!validarEmail(email)) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    }

    if (body.tipo_pessoa === "cpf") {
      if (!validarCpf(sanitizeCpf(body.cpf ?? ""))) {
        return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
      }
    } else if (body.tipo_pessoa === "cnpj") {
      if (!validarCnpj(sanitizeCnpj(body.cnpj ?? ""))) {
        return NextResponse.json({ error: "CNPJ inválido." }, { status: 400 });
      }
      if (!validarCpf(sanitizeCpf(body.responsavel_cpf ?? ""))) {
        return NextResponse.json({ error: "CPF do responsável inválido." }, { status: 400 });
      }
      if (!body.razao_social?.trim() || !body.responsavel_nome?.trim()) {
        return NextResponse.json(
          { error: "Razão social e responsável são obrigatórios." },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json({ error: "Tipo de pessoa inválido." }, { status: 400 });
    }

    // Valida todos os campos obrigatórios antes do primeiro INSERT.
    parseEnderecoContratacao(body);

    if (body.draft.origem === "grupos") {
      const empresaId = await getCatalogEmpresaIdFromRequest(request);
      if (!empresaId) {
        return NextResponse.json({ error: GRUPO_NOT_FOUND_MESSAGE }, { status: 404 });
      }
      try {
        await assertDadosSimulacaoGruposAutorizadosForEmpresa(
          empresaId,
          body.draft.dados_simulacao,
        );
      } catch (err) {
        if (isGrupoNotFoundError(err)) {
          return NextResponse.json({ error: GRUPO_NOT_FOUND_MESSAGE }, { status: 404 });
        }
        throw err;
      }
    }

    const usuario = await getUsuarioNegocio();
    const { row, publicPath } = await criarContratacaoOnline(
      {
        modo: body.draft.modo,
        origem: body.draft.origem,
        dados_simulacao: body.draft.dados_simulacao,
        cliente_pre_nome: nome,
        cliente_pre_telefone: telefone,
        cliente_pre_email: email,
        consultor_id: body.draft.consultor_id,
        consultor_nome: body.draft.consultor_nome,
      },
      usuario,
    );
    contratacaoCriadaId = row.id;

    await atualizarContratacaoPublica(row.public_token, {
      etapa: "dados",
      nome,
      telefone,
      email,
    });
    const updated = await atualizarContratacaoPublica(row.public_token, {
      etapa: "pessoa",
      tipo_pessoa: body.tipo_pessoa,
      cpf: body.cpf,
      data_nascimento: body.data_nascimento,
      razao_social: body.razao_social,
      cnpj: body.cnpj,
      responsavel_nome: body.responsavel_nome,
      responsavel_cpf: body.responsavel_cpf,
      cep: body.cep,
      endereco: body.endereco,
      numero: body.numero,
      complemento: body.complemento,
      bairro: body.bairro,
      cidade: body.cidade,
      uf: body.uf,
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
    if (contratacaoCriadaId) {
      const admin = createAdminClient();
      const { data: criada } = await admin
        .from("contratacoes_online")
        .select("lead_id")
        .eq("id", contratacaoCriadaId)
        .maybeSingle();
      await admin.from("contratacoes_online").delete().eq("id", contratacaoCriadaId);
      if (criada?.lead_id) {
        await admin.from("leads").delete().eq("id", criada.lead_id);
      }
    }
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
