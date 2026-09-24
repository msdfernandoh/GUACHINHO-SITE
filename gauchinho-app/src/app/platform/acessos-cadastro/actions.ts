"use server";

import { randomInt } from "node:crypto";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createAdminClient } from "@/lib/supabase/admin";

export type CadastroAcessoState = { status: "IDLE" | "ERROR" | "SUCCESS"; message: string; email?: string; senha?: string };

function senhaTemporaria() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-_";
  return Array.from({ length: 20 }, () => chars[randomInt(chars.length)]).join("");
}

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
  return { status: "SUCCESS", message: "Acesso de leitura criado por 30 dias. Copie a senha agora: ela não será exibida novamente.", email, senha };
}
