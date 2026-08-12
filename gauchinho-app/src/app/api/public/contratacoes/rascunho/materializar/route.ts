import { NextResponse } from "next/server";
import { rejectIfTenantBlocksLegacyOperationalApi } from "@/lib/tenant/assert-legacy-operational-api";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { isContratacaoDraftPayload } from "@/lib/contratacoes-online/draft";
import { criarPropostaDoFluxo, atualizarFluxoProposta } from "@/lib/contratacoes-online/proposta-flow";
import { sanitizeContratacaoPublica } from "@/lib/contratacoes-online/sanitize-public";
import { getCatalogEmpresaIdFromRequest } from "@/lib/grupos/resolve-catalog-empresa";

/** Persiste somente a proposta após nome + telefone. Nunca cria contratação. */
export async function POST(request: Request) {
  const tenantBlocked = await rejectIfTenantBlocksLegacyOperationalApi(request);
  if (tenantBlocked) return tenantBlocked;
  try {
    const body = await request.json() as Record<string, unknown>;
    if (!isContratacaoDraftPayload(body.draft)) return NextResponse.json({ error: "Rascunho inválido" }, { status: 400 });
    const empresaId = await getCatalogEmpresaIdFromRequest(request);
    if (!empresaId) return NextResponse.json({ error: "Tenant não identificado." }, { status: 404 });
    const usuario = await getUsuarioNegocio();
    let proposal = await criarPropostaDoFluxo({
      draft: body.draft,
      empresaId,
      nome: String(body.nome ?? ""),
      telefone: String(body.telefone ?? ""),
      email: String(body.email ?? ""),
      gerador: usuario,
    });
    if (body.tipo_pessoa) {
      proposal = await atualizarFluxoProposta(proposal.public_token, empresaId, {
        etapa: "pessoa",
        tipo_pessoa: body.tipo_pessoa as "cpf" | "cnpj",
        cpf: String(body.cpf ?? ""), data_nascimento: String(body.data_nascimento ?? ""),
        razao_social: String(body.razao_social ?? ""), cnpj: String(body.cnpj ?? ""),
        responsavel_nome: String(body.responsavel_nome ?? ""), responsavel_cpf: String(body.responsavel_cpf ?? ""),
        cep: String(body.cep ?? ""), endereco: String(body.endereco ?? ""), numero: String(body.numero ?? ""),
        complemento: String(body.complemento ?? ""), bairro: String(body.bairro ?? ""), cidade: String(body.cidade ?? ""), uf: String(body.uf ?? ""),
      });
    }
    return NextResponse.json({ ok: true, public_token: proposal.public_token, path: `/proposta/${proposal.public_token}`, proposta: sanitizeContratacaoPublica(proposal) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro interno" }, { status: 400 });
  }
}
