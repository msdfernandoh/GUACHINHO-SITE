"use server";

import { randomInt } from "node:crypto";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type CredenciaisIniciais = {
  email: string;
  senhaTemporaria?: string;
  usuarioJaExistente: boolean;
  empresaAtivada: boolean;
};

export type PlatformFormState = {
  status: "IDLE" | "SUCCESS" | "ERROR";
  message: string;
  data?: CredenciaisIniciais;
};

function gerarSenhaTemporaria(): string {
  const grupos = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%&*+-_",
  ];
  const todos = grupos.join("");
  const caracteres = grupos.map((grupo) => grupo[randomInt(grupo.length)]);

  while (caracteres.length < 16) {
    caracteres.push(todos[randomInt(todos.length)]);
  }
  for (let i = caracteres.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join("");
}

async function provisionarAcessoDireto(linkId: string, nome: string, empresaId: string) {
  const admin = createAdminClient();
  const { data: link, error: linkError } = await admin
    .from("empresa_usuarios")
    .select("id, usuario_id, is_responsavel_principal")
    .eq("id", linkId)
    .single();

  if (linkError || !link) {
    return { ok: false as const, message: "Vínculo criado, mas não foi possível localizar a identidade de acesso." };
  }

  const { data: usuario, error: usuarioError } = await admin
    .from("usuarios")
    .select("id, email, auth_user_id")
    .eq("id", link.usuario_id)
    .single();

  if (usuarioError || !usuario) {
    return { ok: false as const, message: "Vínculo criado, mas não foi possível localizar a identidade de acesso." };
  }

  if (!usuario?.id || !usuario.email) {
    return { ok: false as const, message: "Vínculo criado, mas a identidade não possui e-mail válido." };
  }

  if (usuario.auth_user_id) {
    const { data: outroVinculo } = await admin
      .from("empresa_usuarios")
      .select("id")
      .eq("usuario_id", usuario.id)
      .eq("ativo", true)
      .eq("status", "ATIVO")
      .neq("id", linkId)
      .limit(1)
      .maybeSingle();

    if (outroVinculo) {
      const { error: ativacaoError } = await admin
        .from("empresa_usuarios")
        .update({ status: "ATIVO", ativo: true })
        .eq("id", linkId);
      if (ativacaoError) {
        return { ok: false as const, message: `Não foi possível ativar o vínculo: ${ativacaoError.message}` };
      }
      return {
        ok: true as const,
        credenciais: {
          email: usuario.email,
          usuarioJaExistente: true,
          empresaAtivada: false,
        } as CredenciaisIniciais,
      };
    }
  }

  const senhaTemporaria = gerarSenhaTemporaria();
  let authUserId = usuario.auth_user_id;
  let criouIdentidade = false;

  if (authUserId) {
    const { data: authAtual, error: authAtualError } = await admin.auth.admin.getUserById(authUserId);
    if (authAtualError || !authAtual.user) {
      return { ok: false as const, message: "A identidade existente não pôde ser carregada para gerar a senha inicial." };
    }
    const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, {
      password: senhaTemporaria,
      email_confirm: true,
      app_metadata: {
        ...authAtual.user.app_metadata,
        exige_troca_senha: true,
      },
      user_metadata: {
        ...authAtual.user.user_metadata,
        nome,
        usuario_id: usuario.id,
        empresa_id: empresaId,
      },
    });
    if (updateError) {
      return { ok: false as const, message: `Não foi possível gerar a senha inicial: ${updateError.message}` };
    }
  } else {
    const { data: identidade, error: identidadeError } = await admin.auth.admin.createUser({
      email: usuario.email,
      password: senhaTemporaria,
      email_confirm: true,
      app_metadata: { exige_troca_senha: true },
      user_metadata: { nome, usuario_id: usuario.id, empresa_id: empresaId },
    });
    if (identidadeError || !identidade.user) {
      return {
        ok: false as const,
        message: `Usuário cadastrado, mas a identidade de acesso não pôde ser criada: ${identidadeError?.message || "falha no serviço de autenticação"}.`,
      };
    }
    authUserId = identidade.user.id;
    criouIdentidade = true;
  }

  const { error: identityError } = await admin
    .from("usuarios")
    .update({ auth_user_id: authUserId })
    .eq("id", usuario.id)
    .or(`auth_user_id.is.null,auth_user_id.eq.${authUserId}`);

  if (identityError) {
    if (criouIdentidade && authUserId) await admin.auth.admin.deleteUser(authUserId);
    return {
      ok: false as const,
      message: `Usuário cadastrado, mas a identidade de acesso não pôde ser vinculada: ${identityError.message}`,
    };
  }

  const { error: ativacaoError } = await admin
    .from("empresa_usuarios")
    .update({ status: "ATIVO", ativo: true })
    .eq("id", linkId);
  if (ativacaoError) {
    return { ok: false as const, message: `A senha foi gerada, mas o vínculo não pôde ser ativado: ${ativacaoError.message}` };
  }

  return {
    ok: true as const,
    credenciais: {
      email: usuario.email,
      senhaTemporaria,
      usuarioJaExistente: false,
      empresaAtivada: false,
    } as CredenciaisIniciais,
  };
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

  const acesso = await provisionarAcessoDireto(String(data), nome, empresaId);
  revalidatePath("/platform/usuarios");
  revalidatePath(`/platform/empresas/${empresaId}`);
  revalidatePath("/platform/empresas");
  if (!acesso.ok) {
    return { status: "ERROR", message: acesso.message };
  }

  const admin = createAdminClient();
  const { data: vinculo } = await admin
    .from("empresa_usuarios")
    .select("is_responsavel_principal")
    .eq("id", String(data))
    .single();
  if (vinculo?.is_responsavel_principal) {
    const { error: ativacaoError } = await db.rpc("rpc_platform_ativar_empresa", {
      p_empresa_id: empresaId,
    });
    if (ativacaoError) {
      return {
        status: "SUCCESS",
        message: `Usuário criado e ativo, mas a empresa ainda não pôde ser ativada: ${ativacaoError.message}`,
        data: acesso.credenciais,
      };
    }
    acesso.credenciais.empresaAtivada = true;
  }
  return {
    status: "SUCCESS",
    message: acesso.credenciais.usuarioJaExistente
      ? `Usuário já possuía acesso e foi ativado nesta franquia.${acesso.credenciais.empresaAtivada ? " Empresa ativada com sucesso." : " Ele deve usar a senha atual."}`
      : `Usuário criado e ativo.${acesso.credenciais.empresaAtivada ? " Empresa ativada com sucesso." : ""} Copie a senha inicial agora; ela não será exibida novamente.`,
    data: acesso.credenciais,
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
  revalidatePath("/platform/empresas");
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

/** Redefinição explícita: não provisiona, ativa ou altera vínculos da empresa. */
export async function gerarNovaSenhaPrincipalPlatformAction(
  _prev: PlatformFormState,
  formData: FormData,
): Promise<PlatformFormState> {
  if (!(await isPlatformSuperadmin())) {
    return { status: "ERROR", message: "Acesso restrito ao Platform Superadmin." };
  }
  const linkId = String(formData.get("empresa_usuario_id") ?? "").trim();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  if (!linkId || !empresaId || formData.get("confirmar") !== "true") {
    return { status: "ERROR", message: "Confirme a redefinição da senha do responsável." };
  }
  const db = await createClient();
  const { data: sessao, error: sessaoError } = await db.auth.getUser();
  if (sessaoError || !sessao.user) return { status: "ERROR", message: "Sessão inválida. Entre novamente." };
  const admin = createAdminClient();
  const { data: vinculo, error: vinculoError } = await admin.from("empresa_usuarios")
    .select("usuario_id, is_responsavel_principal, ativo, status")
    .eq("id", linkId).eq("empresa_id", empresaId).single();
  if (vinculoError || !vinculo?.is_responsavel_principal || !vinculo.ativo || vinculo.status !== "ATIVO") {
    return { status: "ERROR", message: "Selecione o responsável principal ativo desta empresa." };
  }
  const { data: usuario, error: usuarioError } = await admin.from("usuarios")
    .select("id, email, auth_user_id, ativo").eq("id", vinculo.usuario_id).single();
  if (usuarioError || !usuario?.ativo || !usuario.auth_user_id || !usuario.email) {
    return { status: "ERROR", message: "O responsável não possui uma identidade de acesso ativa. Use o cadastro de acesso primeiro." };
  }
  const { data: identidade, error: identidadeError } = await admin.auth.admin.getUserById(usuario.auth_user_id);
  if (identidadeError || !identidade.user || identidade.user.email?.toLowerCase() !== usuario.email.toLowerCase()) {
    return { status: "ERROR", message: "A identidade de autenticação não corresponde ao usuário cadastrado." };
  }
  const senhaTemporaria = gerarSenhaTemporaria();
  const { error } = await admin.auth.admin.updateUserById(usuario.auth_user_id, {
    password: senhaTemporaria,
    app_metadata: {
      ...identidade.user.app_metadata,
      exige_troca_senha: true,
      senha_redefinida_em: new Date().toISOString(),
      senha_redefinida_por: sessao.user.id,
    },
  });
  if (error) return { status: "ERROR", message: "Não foi possível redefinir a senha. Tente novamente." };
  revalidatePath("/platform/usuarios");
  revalidatePath(`/platform/empresas/${empresaId}`);
  return {
    status: "SUCCESS",
    message: "Nova senha temporária gerada. Copie agora e entregue ao responsável por um canal seguro. A troca será exigida no próximo login.",
    data: { email: usuario.email, senhaTemporaria, usuarioJaExistente: true, empresaAtivada: false },
  };
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

  const admin = createAdminClient();
  const { data: row, error: rowError } = await admin
    .from("empresa_usuarios")
    .select("empresa_id, usuario_id")
    .eq("id", linkId)
    .single();
  if (rowError || !row) {
    return { status: "ERROR", message: "O usuário não pôde ser carregado para gerar o acesso." };
  }
  const { data: usuario } = await admin
    .from("usuarios")
    .select("nome")
    .eq("id", row.usuario_id)
    .maybeSingle();
  const acesso = await provisionarAcessoDireto(linkId, usuario?.nome || "Usuário", row.empresa_id);
  revalidatePath("/platform/usuarios");
  revalidatePath(`/platform/empresas/${row.empresa_id}`);
  if (!acesso.ok) return { status: "ERROR", message: acesso.message };
  return {
    status: "SUCCESS",
    message: acesso.credenciais.usuarioJaExistente
      ? "Vínculo ativado. O usuário deve usar a senha atual."
      : "Nova senha inicial gerada. Copie-a agora; ela não será exibida novamente.",
    data: acesso.credenciais,
  };
}
