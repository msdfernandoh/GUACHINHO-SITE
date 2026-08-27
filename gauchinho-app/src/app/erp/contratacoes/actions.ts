"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTenantPermission } from "@/lib/tenant/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { converterContratacaoEmVenda } from "@/lib/vendas/vendas-service";
import { assertSnapshotCalculoGruposIntegro } from "@/lib/contratacoes-online/snapshot-calculo-grupos";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function classificarPendencia(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("grupo")) return "GRUPO_NAO_CONFIGURADO";
  if (normalized.includes("produto") || normalized.includes("cota")) return "PRODUTO_COMERCIAL_AUSENTE";
  if (normalized.includes("consultor") || normalized.includes("participante")) return "CONSULTOR_INVALIDO";
  if (normalized.includes("comiss") || normalized.includes("regra") || normalized.includes("programa")) return "REGRA_COMISSAO_AUSENTE";
  if (normalized.includes("documento")) return "DOCUMENTO_OBRIGATORIO_AUSENTE";
  if (normalized.includes("cliente")) return "CLIENTE_INCOMPLETO";
  if (normalized.includes("venda já") || normalized.includes("venda existente")) return "VENDA_JA_EXISTENTE";
  return "DADOS_INCOMPLETOS";
}

export async function formalizarContratacaoAction(formData: FormData) {
  const { empresaAtiva } = await requireTenantPermission("formalizar_vendas");
  const contratacaoId = value(formData, "contratacao_id");
  const grupoId = value(formData, "grupo_id");
  const opcaoCotaId = value(formData, "opcao_cota_id");
  const principalId = value(formData, "participante_principal_id");
  const secundarioId = value(formData, "participante_secundario_id") || null;
  const fracao = value(formData, "fracao_secundario");
  const perfilPrincipalId = value(formData, "perfil_principal_id") || null;
  const perfilSecundarioId = value(formData, "perfil_secundario_id") || null;
  const modalidadeComissaoId = value(formData, "modalidade_comissao_id");
  const cronogramaSecundario = value(formData, "cronograma_secundario") || "SEGUIR_PRINCIPAL";
  const dataPrimeiraParcela = value(formData, "data_primeira_parcela") || null;
  const dataSegundaParcela = value(formData, "data_segunda_parcela") || null;
  const admin = createAdminClient();
  const db = await createClient();
  try {
    const { data: contratacao, error: contratacaoError } = await admin
      .from("contratacoes_online")
      .select("id,nome,cpf,cnpj,email,telefone,cliente_id,contrato_assinado,dados_simulacao")
      .eq("id", contratacaoId).eq("empresa_id", empresaAtiva.id).maybeSingle();
    if (contratacaoError || !contratacao) throw new Error(contratacaoError?.message || "Contratação não encontrada.");
    if (!contratacao.contrato_assinado) throw new Error("Contrato ainda não foi assinado.");
    assertSnapshotCalculoGruposIntegro(
      (contratacao.dados_simulacao ?? {}) as Record<string, unknown>,
    );
    if (!(contratacao.cpf || contratacao.cnpj) || !contratacao.nome || !contratacao.telefone || !contratacao.email) throw new Error("Cliente incompleto: nome, documento, telefone e e-mail são obrigatórios.");
    const { count: documentos, error: documentosError } = await admin.from("contratacoes_documentos").select("id", { count: "exact", head: true }).eq("contratacao_id", contratacaoId);
    if (documentosError) throw new Error(documentosError.message);
    if (!documentos) throw new Error("Documento obrigatório ausente.");

    if (!grupoId || !opcaoCotaId || !principalId || !modalidadeComissaoId) {
      throw new Error("Grupo, produto, modalidade e consultor principal são obrigatórios.");
    }

    // Uma única RPC autenticada valida todos os UUIDs no tenant e congela o snapshot
    // comercial antes da conversão. Percentuais nunca são aceitos do navegador.
    const { error: prepararError } = await db.rpc("rpc_preparar_formalizacao_contratacao", {
      p_empresa_id: empresaAtiva.id,
      p_contratacao_id: contratacaoId,
      p_grupo_id: grupoId,
      p_opcao_cota_id: opcaoCotaId,
      p_modalidade_comissao_id: modalidadeComissaoId,
      p_participante_principal_id: principalId,
      p_participante_secundario_id: secundarioId,
      p_fracao_secundario: secundarioId && fracao ? Number(fracao) : null,
      p_perfil_principal_id: perfilPrincipalId,
      p_perfil_secundario_id: perfilSecundarioId,
      p_cronograma_secundario: cronogramaSecundario,
      p_data_primeira_parcela: dataPrimeiraParcela,
      p_data_segunda_parcela: dataSegundaParcela,
    });
    if (prepararError) throw new Error(prepararError.message);
    const result = await converterContratacaoEmVenda(empresaAtiva.id, contratacaoId, `erp-formalizacao:${contratacaoId}`);

    revalidatePath("/erp/contratacoes");
    revalidatePath(`/erp/contratacoes/${contratacaoId}`);
    revalidatePath("/erp/clientes");
    revalidatePath("/erp/vendas");
    revalidatePath("/erp/minhas-comissoes");
    redirect(`/erp/contratacoes/${contratacaoId}?sucesso=1&venda=${result.venda.id}&cota=${result.cotaDefinitiva.id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw error;
    const message = error instanceof Error ? error.message : "Não foi possível formalizar.";
    const codigo = classificarPendencia(message);
    await admin.from("contratacoes_online").update({ status_operacional_erp: "PENDENCIA", pendencia_codigo: codigo, pendencia_descricao: message }).eq("id", contratacaoId).eq("empresa_id", empresaAtiva.id);
    await admin.from("contratacoes_formalizacao_historico").insert({ empresa_id: empresaAtiva.id, contratacao_id: contratacaoId, evento: "PENDENCIA_REGISTRADA", descricao: message, dados: { codigo } });
    revalidatePath("/erp/contratacoes");
    redirect(`/erp/contratacoes/${contratacaoId}?erro=${encodeURIComponent(message)}`);
  }
}
