"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { canManageUsers } from "@/lib/auth/permissions";

export async function fetchUsuarios() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nome, email, telefone, perfil, ativo, created_at")
    .order("nome");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createUsuarioAction(formData: FormData) {
  const usuario = await requireUsuario();
  if (!canManageUsers(usuario.perfil)) {
    throw new Error("Apenas Master pode criar usuários");
  }

  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const perfil = String(formData.get("perfil") ?? "srd").trim();
  const telefone = String(formData.get("telefone") ?? "").trim() || null;

  const admin = createAdminClient();
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError) throw new Error(authError.message);

  const { error } = await admin.from("usuarios").insert({
    auth_user_id: authUser.user.id,
    nome,
    email,
    telefone,
    perfil,
    ativo: true,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios");
}

export async function toggleUsuarioAtivoAction(id: string, ativo: boolean) {
  const usuario = await requireUsuario();
  if (!canManageUsers(usuario.perfil)) throw new Error("Sem permissão");
  const supabase = await createClient();
  await supabase.from("usuarios").update({ ativo }).eq("id", id);
  revalidatePath("/admin/usuarios");
}
