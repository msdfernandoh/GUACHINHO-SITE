"use server";

import { revalidatePath } from "next/cache";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createClient } from "@/lib/supabase/server";

export type PlatformFormState = {
  status: "IDLE" | "SUCCESS" | "ERROR";
  message: string;
  data?: unknown;
};

export async function salvarAssinaturaPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const planoId = String(formData.get("plano_id") ?? "").trim();
  const status = String(formData.get("status") ?? "ATIVA").trim();
  const usuariosContratados = Number(formData.get("usuarios_contratados") ?? 10);
  const sitesParceirosContratados = Number(formData.get("sites_parceiros_contratados") ?? 0);
  const sitesDominioProprioContratados = Number(formData.get("sites_dominio_proprio_contratados") ?? 0);
  const valorMensal = formData.get("valor_mensal") ? Number(formData.get("valor_mensal")) : null;
  const taxaImplantacao = formData.get("taxa_implantacao") ? Number(formData.get("taxa_implantacao")) : null;
  const observacao = String(formData.get("observacao") ?? "").trim() || null;

  if (!id || !planoId) {
    return { status: "ERROR", message: "ID da assinatura e do plano são obrigatórios." };
  }

  const db = await createClient();
  const { error } = await db.rpc("rpc_platform_salvar_assinatura", {
    p_id: id,
    p_plano_id: planoId,
    p_status: status,
    p_usuarios_contratados: usuariosContratados,
    p_sites_parceiros_contratados: sitesParceirosContratados,
    p_sites_dominio_proprio_contratados: sitesDominioProprioContratados,
    p_valor_mensal: valorMensal,
    p_taxa_implantacao: taxaImplantacao,
    p_observacao: observacao,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath("/platform/assinaturas");
  revalidatePath("/platform/empresas");
  return { status: "SUCCESS", message: "Assinatura da Master Franquia atualizada com sucesso." };
}

export async function alterarStatusAssinaturaPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim().toUpperCase();

  if (!id || !status) {
    return { status: "ERROR", message: "ID e Status são obrigatórios." };
  }

  const db = await createClient();
  const { error } = await db
    .from("saas_assinaturas")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath("/platform/assinaturas");
  return { status: "SUCCESS", message: `Status da assinatura alterado para ${status}.` };
}
