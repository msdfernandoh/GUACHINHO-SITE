import { createClient } from "@/lib/supabase/server";
import type { Perfil, UsuarioNegocio } from "@/lib/auth/permissions";

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getUsuarioNegocio(): Promise<UsuarioNegocio | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, auth_user_id, nome, email, perfil, ativo")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || !data || !data.ativo) return null;

  return {
    id: data.id,
    auth_user_id: data.auth_user_id,
    nome: data.nome,
    email: data.email,
    perfil: data.perfil as Perfil,
    ativo: data.ativo,
  };
}

export async function requireUsuario(): Promise<UsuarioNegocio> {
  const u = await getUsuarioNegocio();
  if (!u) {
    throw new Error("Não autenticado ou perfil inativo");
  }
  return u;
}
