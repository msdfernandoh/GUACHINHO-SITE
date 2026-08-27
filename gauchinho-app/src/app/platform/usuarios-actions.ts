"use server";

import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPublicSiteUrl } from "@/lib/url/public-url";
import { revalidatePath } from "next/cache";

export type PlatformFormState = {
  status: "IDLE" | "SUCCESS" | "ERROR";
  message: string;
  data?: unknown;
};

async function enviarConviteAcesso(linkId: string, nome: string, empresaId: string, reenviar = false) {
  const admin = createAdminClient();
  const { data: link, error: linkError } = await admin
    .from("empresa_usuarios")
    .select("id, usuario_id, status")
    .eq("id", linkId)
    .single();

  if (linkError || !link) {
    return { ok: false as const, message: "Vínculo criado, mas não foi possível localizar a identidade para enviar o convite." };
  }

  const { data: usuario, error: usuarioError } = await admin
    .from("usuarios")
    .select("id, email, auth_user_id")
    .eq("id", link.usuario_id)
    .single();

  if (usuarioError || !usuario) {
    return { ok: false as const, message: "Vínculo criado, mas não foi possível localizar a identidade para enviar o convite." };
  }

  if (!usuario?.id || !usuario.email) {
    return { ok: false as const, message: "Vínculo criado, mas a identidade não possui e-mail válido para convite." };
  }

  const redirectTo = `${getPublicSiteUrl()}/definir-senha?next=/admin`;
  if (usuario.auth_user_id && (reenviar || link.status === "CONVIDADO")) {
    const { error: recoveryError } = await admin.auth.resetPasswordForEmail(usuario.email, { redirectTo });
    if (recoveryError) {
      return { ok: false as const, message: `Não foi possível reenviar o e-mail de acesso: ${recoveryError.message}` };
    }
    return { ok: true as const, invited: true, email: usuario.email };
  }

  if (usuario.auth_user_id) {
    return { ok: true as const, invited: false, email: usuario.email };
  }

  const { data: convite, error: conviteError } = await admin.auth.admin.inviteUserByEmail(usuario.email, {
    redirectTo,
    data: { nome, usuario_id: usuario.id, empresa_id: empresaId },
  });

  if (conviteError || !convite.user) {
    return {
      ok: false as const,
      message: `Usuário cadastrado, mas o e-mail de acesso não foi enviado: ${conviteError?.message || "falha no serviço de autenticação"}. Use Reenviar após conferir o e-mail.`,
    };
  }

  const { error: identityError } = await admin
    .from("usuarios")
    .update({ auth_user_id: convite.user.id })
    .eq("id", usuario.id)
    .is("auth_user_id", null);

  if (identityError) {
    await admin.auth.admin.deleteUser(convite.user.id);
    return {
      ok: false as const,
      message: `Usuário cadastrado, mas a identidade de acesso não pôde ser vinculada: ${identityError.message}`,
    };
  }

  return { ok: true as const, invited: true, email: usuario.email };
}

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

  const convite = await enviarConviteAcesso(String(data), nome, empresaId);
  revalidatePath("/platform/usuarios");
  revalidatePath(`/platform/empresas/${empresaId}`);
  if (!convite.ok) {
    return { status: "ERROR", message: convite.message, data };
  }
  return {
    status: "SUCCESS",
    message: convite.invited
      ? `Usuário cadastrado. Convite seguro enviado para ${email}.`
      : `Usuário já possuía acesso e foi vinculado à franquia com sucesso.`,
    data,
  };
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

  revalidatePath("/platform/usuarios");
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

  revalidatePath("/platform/usuarios");
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

  const admin = createAdminClient();
  const { data: row, error: rowError } = await admin
    .from("empresa_usuarios")
    .select("empresa_id, usuario_id")
    .eq("id", linkId)
    .single();
  if (rowError || !row) {
    return { status: "ERROR", message: "Convite marcado como pendente, mas o usuário não pôde ser carregado." };
  }
  const { data: usuario } = await admin
    .from("usuarios")
    .select("nome")
    .eq("id", row.usuario_id)
    .maybeSingle();
  const convite = await enviarConviteAcesso(linkId, usuario?.nome || "Usuário", row.empresa_id, true);
  revalidatePath("/platform/usuarios");
  revalidatePath(`/platform/empresas/${row.empresa_id}`);
  if (!convite.ok) return { status: "ERROR", message: convite.message };
  return {
    status: "SUCCESS",
    message: convite.invited ? "Convite reenviado com sucesso." : "O usuário já possui acesso ativo.",
  };
}
