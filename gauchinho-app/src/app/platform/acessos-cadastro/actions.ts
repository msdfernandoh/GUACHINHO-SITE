"use server";

import { randomInt } from "node:crypto";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type CadastroAcessoState = { status: "IDLE" | "ERROR" | "SUCCESS"; message: string; email?: string; senha?: string };
export type RevisorTecnicoItem = { usuario_id: string; nome: string; email: string; ativo: boolean; expira_em: string; criado_em: string };

function senhaTemporaria() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-_";
  return Array.from({ length: 20 }, () => chars[randomInt(chars.length)]).join("");
}

function revalidarAcessosTecnicos() { revalidatePath("/platform/acessos-cadastro"); revalidatePath("/platform/revisao"); }

export async function criarAcessoCadastroAction(_previous: CadastroAcessoState, formData: FormData): Promise<CadastroAcessoState> {
  if (!(await isPlatformSuperadmin())) return { status: "ERROR", message: "Acesso restrito ao superadmin." };
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (nome.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "ERROR", message: "Informe nome e e-mail válidos." };
  }
  const admin = createAdminClient();
  const { data: existing } = await admin.from("usuarios").select("id").eq("email", email).maybeSingle();
  if (existing) return { status: "ERROR", message: "Esse e-mail já pertence a uma conta. Use um e-mail exclusivo para o acesso limitado." };

  const senha = senhaTemporaria();
  const { data: auth, error: authError } = await admin.auth.admin.createUser({
    email, password: senha, email_confirm: true,
    app_metadata: { exige_troca_senha: true }, user_metadata: { nome },
  });
  if (authError || !auth.user) return { status: "ERROR", message: authError?.message ?? "Falha ao criar identidade." };
  const { data: usuario, error: userError } = await admin.from("usuarios")
    .insert({ auth_user_id: auth.user.id, nome, email, perfil: "parceiro", ativo: true })
    .select("id").single();
  if (userError || !usuario) {
    await admin.auth.admin.deleteUser(auth.user.id);
    return { status: "ERROR", message: userError?.message ?? "Falha ao criar usuário." };
  }
  const expiraEm = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error: linkError } = await admin.from("plataforma_revisores_tecnicos").insert({ usuario_id: usuario.id, ativo: true, expira_em: expiraEm });
  if (linkError) {
    await admin.auth.admin.deleteUser(auth.user.id);
    return { status: "ERROR", message: linkError.message };
  }
  revalidarAcessosTecnicos();
  return { status: "SUCCESS", message: "Acesso de leitura criado por 30 dias. Copie a senha agora: ela não será exibida novamente.", email, senha };
}

async function carregarRevisorElegivel(usuarioId: string) {
  const admin = createAdminClient();
  const { data: revisor, error: revisorError } = await admin.from("plataforma_revisores_tecnicos").select("usuario_id").eq("usuario_id", usuarioId).maybeSingle();
  if (revisorError || !revisor) return { admin, error: "Revisor técnico não encontrado." };
  const { data: usuario, error: usuarioError } = await admin.from("usuarios").select("id,email,auth_user_id,ativo").eq("id", usuarioId).maybeSingle();
  if (usuarioError || !usuario?.ativo || !usuario.auth_user_id || !usuario.email) return { admin, error: "O revisor não possui uma identidade de acesso ativa." };
  return { admin, usuario };
}

export async function gerarNovaSenhaRevisorAction(_previous: CadastroAcessoState, formData: FormData): Promise<CadastroAcessoState> {
  if (!(await isPlatformSuperadmin())) return { status: "ERROR", message: "Acesso restrito ao superadmin." };
  const usuarioId = String(formData.get("usuario_id") ?? "").trim();
  if (!usuarioId) return { status: "ERROR", message: "Revisor não informado." };
  const alvo = await carregarRevisorElegivel(usuarioId);
  if ("error" in alvo) return { status: "ERROR", message: alvo.error ?? "Revisor técnico não encontrado." };
  const { data: identidade, error: identidadeError } = await alvo.admin.auth.admin.getUserById(alvo.usuario.auth_user_id);
  if (identidadeError || !identidade.user || identidade.user.email?.toLowerCase() !== alvo.usuario.email.toLowerCase()) return { status: "ERROR", message: "A identidade de autenticação não corresponde ao revisor." };
  const senha = senhaTemporaria();
  const { error } = await alvo.admin.auth.admin.updateUserById(alvo.usuario.auth_user_id, { password: senha, app_metadata: { ...identidade.user.app_metadata, exige_troca_senha: true } });
  if (error) return { status: "ERROR", message: "Não foi possível gerar a nova senha temporária." };
  return { status: "SUCCESS", message: "Nova senha temporária gerada. Copie agora e envie por um canal seguro.", email: alvo.usuario.email, senha };
}

export async function alterarRevisorTecnicoAction(_previous: CadastroAcessoState, formData: FormData): Promise<CadastroAcessoState> {
  if (!(await isPlatformSuperadmin())) return { status: "ERROR", message: "Acesso restrito ao superadmin." };
  const usuarioId = String(formData.get("usuario_id") ?? "").trim();
  const operacao = String(formData.get("operacao") ?? "").trim();
  if (!usuarioId || !["alternar", "prorrogar"].includes(operacao)) return { status: "ERROR", message: "Operação de revisor inválida." };
  const alvo = await carregarRevisorElegivel(usuarioId);
  if ("error" in alvo) return { status: "ERROR", message: alvo.error ?? "Revisor técnico não encontrado." };
  if (operacao === "alternar") {
    const { data: atual, error: atualError } = await alvo.admin.from("plataforma_revisores_tecnicos").select("ativo").eq("usuario_id", usuarioId).single();
    if (atualError || !atual) return { status: "ERROR", message: "Não foi possível consultar o estado do revisor." };
    const novoAtivo = !atual.ativo;
    const { error } = await alvo.admin.from("plataforma_revisores_tecnicos").update({ ativo: novoAtivo }).eq("usuario_id", usuarioId);
    if (error) return { status: "ERROR", message: "Não foi possível alterar o status do revisor." };
    revalidarAcessosTecnicos();
    return { status: "SUCCESS", message: novoAtivo ? "Acesso de revisão reativado." : "Acesso de revisão inativado imediatamente." };
  }
  const { data: atual, error: atualError } = await alvo.admin.from("plataforma_revisores_tecnicos").select("expira_em").eq("usuario_id", usuarioId).single();
  if (atualError || !atual) return { status: "ERROR", message: "Não foi possível consultar a validade do revisor." };
  const base = Math.max(Date.now(), new Date(atual.expira_em).getTime());
  const expiraEm = new Date(base + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await alvo.admin.from("plataforma_revisores_tecnicos").update({ expira_em: expiraEm }).eq("usuario_id", usuarioId);
  if (error) return { status: "ERROR", message: "Não foi possível prorrogar o acesso." };
  revalidarAcessosTecnicos();
  return { status: "SUCCESS", message: "Acesso prorrogado por mais 30 dias." };
}
