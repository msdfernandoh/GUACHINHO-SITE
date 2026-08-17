"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { converterContratacaoEmVenda } from "@/lib/vendas/vendas-service";

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
  await requireStaffAdmin();
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva?.id) redirect("/erp/contratacoes?erro=Tenant não identificado");
  const contratacaoId = value(formData, "contratacao_id");
  const grupoId = value(formData, "grupo_id");
  const opcaoCotaId = value(formData, "opcao_cota_id");
  const principalId = value(formData, "participante_principal_id");
  const secundarioId = value(formData, "participante_secundario_id") || null;
  const fracao = value(formData, "fracao_secundario");
  const admin = createAdminClient();
  try {
    const { data: contratacao, error: contratacaoError } = await admin
      .from("contratacoes_online")
      .select("id,nome,cpf,cnpj,email,telefone,cliente_id,contrato_assinado")
      .eq("id", contratacaoId).eq("empresa_id", empresaAtiva.id).maybeSingle();
    if (contratacaoError || !contratacao) throw new Error(contratacaoError?.message || "Contratação não encontrada.");
    if (!contratacao.contrato_assinado) throw new Error("Contrato ainda não foi assinado.");
    if (!(contratacao.cpf || contratacao.cnpj) || !contratacao.nome || !contratacao.telefone || !contratacao.email) throw new Error("Cliente incompleto: nome, documento, telefone e e-mail são obrigatórios.");
    const { count: documentos, error: documentosError } = await admin.from("contratacoes_documentos").select("id", { count: "exact", head: true }).eq("contratacao_id", contratacaoId);
    if (documentosError) throw new Error(documentosError.message);
    if (!documentos) throw new Error("Documento obrigatório ausente.");
    if (!contratacao.cliente_id) {
      const { error: syncError } = await admin.from("contratacoes_online").update({ contrato_assinado: true }).eq("id", contratacaoId).eq("empresa_id", empresaAtiva.id);
      if (syncError) throw new Error(syncError.message);
    }
    const { error: prepararError } = await admin.rpc("rpc_preparar_formalizacao_contratacao", {
      p_empresa_id: empresaAtiva.id,
      p_contratacao_id: contratacaoId,
      p_grupo_id: grupoId,
      p_opcao_cota_id: opcaoCotaId,
      p_participante_principal_id: principalId,
      p_participante_secundario_id: secundarioId,
      p_fracao_secundario: secundarioId ? Number(fracao) : null,
    });
    if (prepararError) throw new Error(prepararError.message);
    const result = await converterContratacaoEmVenda(empresaAtiva.id, contratacaoId, `erp-formalizacao:${contratacaoId}`);
    revalidatePath("/erp/contratacoes");
    revalidatePath(`/erp/contratacoes/${contratacaoId}`);
    revalidatePath("/erp/clientes");
    revalidatePath("/erp/vendas");
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
