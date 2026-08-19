"use server";

import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createClient } from "@/lib/supabase/server";

export type PlatformFormState = {
  status: "IDLE" | "SUCCESS" | "ERROR";
  message: string;
  data?: unknown;
};

export async function convidarUsuarioPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const papelId = String(formData.get("papel_id") ?? "").trim();
  const isResponsavel = formData.get("is_responsavel") === "true";

  let modulos: string[] = [];
  const rawModulos = formData.get("modulos_json");
  if (rawModulos) {
    try {
      modulos = JSON.parse(String(rawModulos));
    } catch {
      modulos = [];
    }
  }

  if (!empresaId || !nome || !email || !papelId) {
    return { status: "ERROR", message: "Master Franquia, Nome, E-mail e Papel são obrigatórios." };
  }

  const db = await createClient();
  const { data, error } = await db.rpc("rpc_platform_convidar_usuario", {
    p_empresa_id: empresaId,
    p_nome: nome,
    p_email: email,
    p_papel_id: papelId,
    p_modulos: modulos,
    p_is_responsavel: isResponsavel,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  return { status: "SUCCESS", message: `Convite enviado com sucesso para ${email}.`, data };
}

export async function alterarUsuarioPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const linkId = String(formData.get("empresa_usuario_id") ?? "").trim();
  const papelId = String(formData.get("papel_id") ?? "").trim();
  const ativo = formData.get("ativo") !== "false";
  const status = String(formData.get("status") ?? "ATIVO").trim();

  let modulos: string[] = [];
  const rawModulos = formData.get("modulos_json");
  if (rawModulos) {
    try {
      modulos = JSON.parse(String(rawModulos));
    } catch {
      modulos = [];
    }
  }

  if (!linkId || !papelId) {
    return { status: "ERROR", message: "Identificador do usuário e Papel são obrigatórios." };
  }

  const db = await createClient();
  const { error } = await db.rpc("rpc_platform_alterar_usuario", {
    p_empresa_usuario_id: linkId,
    p_papel_id: papelId,
    p_modulos: modulos,
    p_ativo: ativo,
    p_status: status,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  return { status: "SUCCESS", message: "Usuário atualizado com sucesso." };
}

export async function definirResponsavelPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const linkId = String(formData.get("empresa_usuario_id") ?? "").trim();

  if (!empresaId || !linkId) {
    return { status: "ERROR", message: "Empresa e Usuário são obrigatórios." };
  }

  const db = await createClient();
  const { error } = await db.rpc("rpc_platform_definir_responsavel_empresa", {
    p_empresa_id: empresaId,
    p_empresa_usuario_id: linkId,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  return { status: "SUCCESS", message: "Responsável principal da Master Franquia transferido com sucesso." };
}

export async function reenviarConvitePlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }

  const linkId = String(formData.get("empresa_usuario_id") ?? "").trim();

  if (!linkId) {
    return { status: "ERROR", message: "Usuário é obrigatório." };
  }

  const db = await createClient();
  const { error } = await db.rpc("rpc_platform_reenviar_convite_usuario", {
    p_empresa_usuario_id: linkId,
  });

  if (error) {
    return { status: "ERROR", message: error.message };
  }

  return { status: "SUCCESS", message: "Convite reenviado com sucesso." };
}
