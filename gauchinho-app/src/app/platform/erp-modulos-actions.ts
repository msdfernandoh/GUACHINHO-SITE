"use server";

import { revalidatePath } from "next/cache";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createClient } from "@/lib/supabase/server";

export type PlatformFormState = {
  status: "IDLE" | "SUCCESS" | "ERROR";
  message: string;
  data?: unknown;
};

export async function salvarModuloCatalogoPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const categoria = String(formData.get("categoria") ?? "OPERACIONAL").trim();
  const status = String(formData.get("status") ?? "ATIVO").trim();
  const ordemPadrao = Number(formData.get("ordem_padrao") ?? 0);

  let dependencias: string[] = [];
  const rawDep = formData.get("dependencias_json");
  if (rawDep) {
    try {
      dependencias = JSON.parse(String(rawDep));
    } catch {
      dependencias = [];
    }
  }

  if (!id || !nome) {
    return { status: "ERROR", message: "ID e Nome do módulo são obrigatórios." };
  }

  const db = await createClient();
  const { error } = await db.rpc("rpc_platform_salvar_modulo_catalogo", {
    p_id: id,
    p_nome: nome,
    p_descricao: descricao,
    p_categoria: categoria,
    p_status: status,
    p_ordem_padrao: ordemPadrao,
    p_dependencias: dependencias,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath("/platform/erp-modulos");
  return { status: "SUCCESS", message: "Módulo do catálogo atualizado com sucesso." };
}

export async function toggleStatusModuloPlatformAction(
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
    .from("erp_modulos_catalogo")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath("/platform/erp-modulos");
  return { status: "SUCCESS", message: `Módulo ${status === "ATIVO" ? "ativado" : "inativado"} com sucesso.` };
}


export async function criarModuloCatalogoPlatformAction(

  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const nome = String(formData.get("nome") ?? "").trim();
  const codigo = String(formData.get("codigo") ?? "").trim() || null;
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const categoria = String(formData.get("categoria") ?? "OPERACIONAL").trim();
  const ordemPadrao = Number(formData.get("ordem_padrao") ?? 0);

  let dependencias: string[] = [];
  const rawDep = formData.get("dependencias_json");
  if (rawDep) {
    try {
      dependencias = JSON.parse(String(rawDep));
    } catch {
      dependencias = [];
    }
  }

  if (!nome) {
    return { status: "ERROR", message: "Nome do módulo é obrigatório." };
  }

  const db = await createClient();
  const { data, error } = await db.rpc("rpc_platform_criar_modulo_catalogo", {
    p_nome: nome,
    p_codigo: codigo,
    p_descricao: descricao,
    p_categoria: categoria,
    p_ordem_padrao: ordemPadrao,
    p_dependencias: dependencias,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  revalidatePath("/platform/erp-modulos");
  return { status: "SUCCESS", message: "Módulo criado com sucesso no catálogo.", data };
}

