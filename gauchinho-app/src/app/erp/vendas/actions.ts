"use server";

import { revalidatePath } from "next/cache";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { createAdminClient } from "@/lib/supabase/admin";

function val(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function masterAtualizarVendaAction(formData: FormData) {
  const user = await requireStaffAdmin();
  const { empresaAtiva, vinculos } = await getCurrentTenantContext();
  if (!empresaAtiva) throw new Error("Tenant não identificado.");

  const vinculo = (vinculos ?? []).find((item) => item.empresa_id === empresaAtiva?.id);
  const papelNome = vinculo?.papel?.nome?.toLowerCase() ?? "";
  const isMaster = papelNome.includes("master") || papelNome.includes("admin") || papelNome.includes("gestor") || Boolean((user as any)?.is_master);
  if (!isMaster) throw new Error("Apenas o usuário Master tem autorização para editar vendas e comissões.");

  const vendaId = val(formData, "venda_id");
  const numeroCota = val(formData, "numero_cota");
  const principalId = val(formData, "participante_principal_id") || null;
  const secundarioId = val(formData, "participante_secundario_id") || null;
  const fracao = val(formData, "fracao_secundario");
  const dataPrimeira = val(formData, "data_primeira_parcela") || null;
  const dataSegunda = val(formData, "data_segunda_parcela") || null;
  const recalcular = formData.get("recalcular_futuras") === "on";

  const admin = createAdminClient();
  const { error } = await admin.rpc("rpc_master_atualizar_dados_venda", {
    p_empresa_id: empresaAtiva.id,
    p_venda_id: vendaId,
    p_numero_cota: numeroCota,
    p_participante_principal_id: principalId,
    p_participante_secundario_id: secundarioId,
    p_fracao_secundario: secundarioId && fracao ? Number(fracao) : null,
    p_data_primeira_parcela: dataPrimeira,
    p_data_segunda_parcela: dataSegunda,
    p_recalcular_comissoes_futuras: recalcular,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/erp/vendas");
  revalidatePath("/erp/minhas-comissoes");
  revalidatePath("/erp/comissoes");
  return { ok: true };
}

export async function cancelarCotaEstornoAction(formData: FormData) {
  await requireStaffAdmin();
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) throw new Error("Tenant não identificado.");

  const cotaId = val(formData, "cota_id");
  const motivo = val(formData, "motivo") || "Cancelamento de cota solicitado pelo cliente.";

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("rpc_cancelar_cota_com_estorno", {
    p_empresa_id: empresaAtiva.id,
    p_cota_id: cotaId,
    p_motivo: motivo,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/erp/vendas");
  revalidatePath("/erp/minhas-comissoes");
  revalidatePath("/erp/comissoes");
  return { ok: true, data };
}

export async function masterExcluirOuEstornarVendaAction(formData: FormData) {
  const user = await requireStaffAdmin();
  const { empresaAtiva, vinculos } = await getCurrentTenantContext();
  if (!empresaAtiva) throw new Error("Tenant não identificado.");

  const vinculo = (vinculos ?? []).find((item) => item.empresa_id === empresaAtiva?.id);
  const papelNome = vinculo?.papel?.nome?.toLowerCase() ?? "";
  const isMaster = papelNome.includes("master") || papelNome.includes("admin") || papelNome.includes("gestor") || Boolean((user as any)?.is_master);
  if (!isMaster) throw new Error("Apenas o usuário Master tem autorização para excluir ou estornar vendas.");

  const vendaId = val(formData, "venda_id");
  const acao = val(formData, "acao"); // "EXCLUIR" ou "ESTORNAR"
  const confirmacao = val(formData, "confirmacao_texto");
  const cancelarPagas = formData.get("cancelar_pagas") === "true";
  const motivo = val(formData, "motivo") || "Ação administrativa do usuário Master.";

  if (acao === "EXCLUIR" && confirmacao !== "EXCLUIR") {
    throw new Error('Para confirmar a exclusão definitiva, você deve digitar "EXCLUIR".');
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("rpc_master_excluir_ou_estornar_venda", {
    p_empresa_id: empresaAtiva.id,
    p_venda_id: vendaId,
    p_acao: acao,
    p_cancelar_comissoes_pagas: cancelarPagas,
    p_motivo: motivo,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/erp/vendas");
  revalidatePath("/erp/contratacoes");
  revalidatePath("/erp/minhas-comissoes");
  revalidatePath("/erp/comissoes");
  return { ok: true, acao };
}

export async function atualizarNumeroCotaAction(formData: FormData) {
  await requireStaffAdmin();
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) throw new Error("Tenant não identificado.");

  const cotaId = val(formData, "cota_id");
  const numeroCota = val(formData, "numero_cota");

  const admin = createAdminClient();
  const { error } = await admin
    .from("cotas_definitivas")
    .update({ numero_cota: NULLIF_OR_VAL(numeroCota), updated_at: new Date().toISOString() })
    .eq("id", cotaId)
    .eq("empresa_id", empresaAtiva.id);

  if (error) throw new Error(error.message);

  revalidatePath("/erp/vendas");
  return { ok: true };
}

export async function registrarContemplacaoAction(formData: FormData) {
  await requireStaffAdmin();
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) throw new Error("Tenant não identificado.");

  const cotaId = val(formData, "cota_id");
  const tipoContemplacao = val(formData, "tipo_contemplacao") || "SORTEIO";
  const dataContemplacao = val(formData, "data_contemplacao") || new Date().toISOString().slice(0, 10);
  const antecipar = formData.get("antecipar_comissoes") === "true";
  const competencia = val(formData, "competencia_antecipada") || dataContemplacao.slice(0, 7);
  const observacao = val(formData, "observacao") || null;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("rpc_registrar_contemplacao_comissoes", {
    p_empresa_id: empresaAtiva.id,
    p_cota_id: cotaId,
    p_tipo_contemplacao: tipoContemplacao,
    p_data_contemplacao: dataContemplacao,
    p_antecipar_comissoes: antecipar,
    p_competencia_antecipada: competencia,
    p_observacao: observacao,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/erp/vendas");
  revalidatePath("/erp/minhas-comissoes");
  revalidatePath("/erp/comissoes");
  return { ok: true, data };
}

function NULLIF_OR_VAL(v: string) {
  return v.trim().length > 0 ? v.trim() : null;
}