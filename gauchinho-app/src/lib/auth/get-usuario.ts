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
    .select("id, auth_user_id, nome, email, perfil, ativo, imobiliaria_id, admin_menus, leads_apenas_proprios")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || !data || !data.ativo) {
    if (error && /admin_menus|leads_apenas_proprios/.test(error.message)) {
      const legacy = await supabase
        .from("usuarios")
        .select("id, auth_user_id, nome, email, perfil, ativo, imobiliaria_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (legacy.error || !legacy.data || !legacy.data.ativo) return null;
      return {
        id: legacy.data.id,
        auth_user_id: legacy.data.auth_user_id,
        nome: legacy.data.nome,
        email: legacy.data.email,
        perfil: legacy.data.perfil as Perfil,
        ativo: legacy.data.ativo,
        imobiliaria_id: legacy.data.imobiliaria_id ?? null,
        admin_menus: null,
        leads_apenas_proprios: false,
      };
    }
    return null;
  }

  return {
    id: data.id,
    auth_user_id: data.auth_user_id,
    nome: data.nome,
    email: data.email,
    perfil: data.perfil as Perfil,
    ativo: data.ativo,
    imobiliaria_id: data.imobiliaria_id ?? null,
    admin_menus: (data.admin_menus as string[] | null) ?? null,
    leads_apenas_proprios: Boolean(data.leads_apenas_proprios),
  };
}

export async function requireUsuario(): Promise<UsuarioNegocio> {
  const u = await getUsuarioNegocio();
  if (!u) {
    throw new Error("Não autenticado ou perfil inativo");
  }
  return u;
}
