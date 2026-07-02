"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { canManageUsers } from "@/lib/auth/permissions";

export async function fetchUsuarios() {
  const supabase = await createClient();
  let { data, error } = await supabase
    .from("usuarios")
    .select("id, nome, email, telefone, perfil, ativo, is_consultor, created_at")
    .order("nome");
  if (error && /is_consultor/.test(error.message)) {
    const legacy = await supabase
      .from("usuarios")
      .select("id, nome, email, telefone, perfil, ativo, created_at")
      .order("nome");
    if (legacy.error) throw new Error(legacy.error.message);
    return (legacy.data ?? []).map((u) => ({ ...u, is_consultor: u.perfil === "srd" }));
  }
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
  const isConsultor = formData.get("is_consultor") === "on";

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
    is_consultor: isConsultor,
  });
  if (error && /is_consultor/.test(error.message)) {
    const { error: err2 } = await admin.from("usuarios").insert({
      auth_user_id: authUser.user.id,
      nome,
      email,
      telefone,
      perfil,
      ativo: true,
    });
    if (err2) throw new Error(err2.message);
  } else if (error) {
    throw new Error(error.message);
  }

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

export async function toggleUsuarioConsultorAction(id: string, isConsultor: boolean) {
  const usuario = await requireUsuario();
  if (!canManageUsers(usuario.perfil)) throw new Error("Sem permissão");
  const supabase = await createClient();
  const { error } = await supabase.from("usuarios").update({ is_consultor: isConsultor }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/agenda");
  revalidatePath("/admin/leads");
}
