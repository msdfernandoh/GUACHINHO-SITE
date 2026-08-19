"use server";

import { revalidatePath } from "next/cache";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createClient } from "@/lib/supabase/server";

export type PlatformFormState = {
  status: "IDLE" | "SUCCESS" | "ERROR";
  message: string;
  data?: unknown;
};

export async function criarDominioTenantPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const valor = String(formData.get("valor") ?? "").trim().toLowerCase();
  const tipo = String(formData.get("tipo") ?? "DOMINIO_CUSTOMIZADO").trim();
  const principal = formData.get("principal") === "true";
  const ativo = formData.get("ativo") !== "false";

  if (!empresaId || !valor) {
    return { status: "ERROR", message: "Empresa e Domínio são obrigatórios." };
  }

  if (valor === "admin.gauchinhoconsorcios.com.br" || valor.startsWith("admin.")) {
    return {
      status: "ERROR",
      message: "O domínio admin.gauchinhoconsorcios.com.br é reservado para a PLATAFORMA SAAS.",
    };
  }

  const db = await createClient();
  const { data, error } = await db.rpc("rpc_platform_criar_dominio_tenant", {
    p_empresa_id: empresaId,
    p_valor: valor,
    p_tipo: tipo,
    p_principal: principal,
    p_ativo: ativo,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath("/platform/dominios");
  return { status: "SUCCESS", message: "Domínio cadastrado com sucesso.", data };
}

export async function definirDominioPrincipalPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();

  if (!id || !empresaId) {
    return { status: "ERROR", message: "ID do domínio e da empresa são obrigatórios." };
  }

  const db = await createClient();

  // Desmarcar principal anterior
  await db
    .from("empresa_dominios")
    .update({ principal: false, updated_at: new Date().toISOString() })
    .eq("empresa_id", empresaId)
    .eq("principal", true);

  // Marcar novo principal
  const { error } = await db
    .from("empresa_dominios")
    .update({ principal: true, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath("/platform/dominios");
  return { status: "SUCCESS", message: "Domínio definido como principal." };
}

export async function toggleStatusDominioPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const ativo = formData.get("ativo") === "true";

  if (!id) {
    return { status: "ERROR", message: "ID do domínio é obrigatório." };
  }

  const db = await createClient();
  const { error } = await db
    .from("empresa_dominios")
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath("/platform/dominios");
  return { status: "SUCCESS", message: `Domínio ${ativo ? "ativado" : "desativado"} com sucesso.` };
}
