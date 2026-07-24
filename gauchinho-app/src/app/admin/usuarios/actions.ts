"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { canManageUsers, PERFIS } from "@/lib/auth/permissions";
import type { AdminMenuKey } from "@/lib/admin/admin-menus";
import { isGmailAddress } from "@/lib/google-calendar/config";

export async function fetchUsuarios() {
  const supabase = await createClient();
  let { data, error } = await supabase
    .from("usuarios")
    .select(
      "id, nome, email, telefone, perfil, ativo, is_consultor, leads_apenas_proprios, google_agenda_sync, google_calendar_connected_at, created_at",
    )
    .order("nome");
  if (error && /is_consultor|leads_apenas_proprios|google_agenda_sync|google_calendar_connected_at/.test(error.message)) {
    const legacy = await supabase
      .from("usuarios")
      .select("id, nome, email, telefone, perfil, ativo, created_at")
      .order("nome");
    if (legacy.error) throw new Error(legacy.error.message);
    return (legacy.data ?? []).map((u) => ({
      ...u,
      is_consultor: u.perfil === "srd",
      leads_apenas_proprios: false,
      google_agenda_sync: false,
      google_calendar_connected_at: null,
    }));
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
  const leadsApenasProprios = formData.get("leads_apenas_proprios") === "on";
  const googleAgendaSync = formData.get("google_agenda_sync") === "on";
  const menuKeys = formData.getAll("admin_menu").map((v) => String(v).trim()) as AdminMenuKey[];
  const adminMenus = menuKeys.length ? menuKeys : null;

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
    leads_apenas_proprios: leadsApenasProprios,
    google_agenda_sync: googleAgendaSync && isGmailAddress(email),
    admin_menus: adminMenus,
  });
  if (
    error &&
    /is_consultor|admin_menus|leads_apenas_proprios|google_agenda_sync/.test(error.message)
  ) {
    const base = {
      auth_user_id: authUser.user.id,
      nome,
      email,
      telefone,
      perfil,
      ativo: true,
    };
    // Tenta preservar a restrição de leads; só cai no insert mínimo se a coluna não existir.
    const attempts: Record<string, unknown>[] = [
      { ...base, is_consultor: isConsultor, leads_apenas_proprios: leadsApenasProprios, google_agenda_sync: googleAgendaSync && isGmailAddress(email) },
      { ...base, leads_apenas_proprios: leadsApenasProprios, google_agenda_sync: googleAgendaSync && isGmailAddress(email) },
      { ...base, is_consultor: isConsultor },
      base,
    ];
    let saved = false;
    let lastMessage = error.message;
    for (const row of attempts) {
      const { error: err2 } = await admin.from("usuarios").insert(row);
      if (!err2) {
        saved = true;
        break;
      }
      lastMessage = err2.message;
    }
    if (!saved) throw new Error(lastMessage);
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

export async function updateUsuarioPerfilAction(formData: FormData) {
  return updateUsuarioEdicaoAction(formData);
}

/** Master — perfil e opções comerciais (consultor, leads, Google Agenda). */
export async function updateUsuarioEdicaoAction(formData: FormData) {
  const current = await requireUsuario();
  if (!canManageUsers(current.perfil)) throw new Error("Sem permissão");

  const id = String(formData.get("usuario_id") ?? "").trim();
  const perfil = String(formData.get("perfil") ?? "").trim();
  if (!id) throw new Error("Usuário inválido");
  if (!PERFIS.includes(perfil as (typeof PERFIS)[number])) {
    throw new Error("Perfil inválido");
  }

  const isConsultor = formData.get("is_consultor") === "on";
  const leadsApenasProprios = formData.get("leads_apenas_proprios") === "on";
  const googleAgendaSyncRequested = formData.get("google_agenda_sync") === "on";

  const supabase = await createClient();
  const { data: alvo } = await supabase.from("usuarios").select("email").eq("id", id).maybeSingle();
  if (!alvo) throw new Error("Usuário não encontrado");

  const email = String(alvo.email ?? "").trim().toLowerCase();
  const googleAgendaSync = googleAgendaSyncRequested && isGmailAddress(email);
  if (googleAgendaSyncRequested && !googleAgendaSync) {
    throw new Error("Sincronização Google Agenda só está disponível para e-mails @gmail.com.");
  }

  const patch: Record<string, unknown> = {
    perfil,
    is_consultor: isConsultor,
    leads_apenas_proprios: leadsApenasProprios,
    google_agenda_sync: googleAgendaSync,
  };
  if (!googleAgendaSync) {
    patch.google_calendar_refresh_token = null;
    patch.google_calendar_connected_at = null;
  }

  const admin = createAdminClient();
  let { error } = await admin.from("usuarios").update(patch).eq("id", id);
  if (error && /is_consultor|leads_apenas_proprios|google_agenda_sync|google_calendar/.test(error.message)) {
    const minimal = { perfil };
    ({ error } = await supabase.from("usuarios").update(minimal).eq("id", id));
    if (!error) {
      throw new Error(
        "Algumas opções não foram salvas. Aplique as migrations 027 e 033 no Supabase.",
      );
    }
  }
  if (error) throw new Error(error.message);

  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/leads");
  revalidatePath("/admin/agenda");
  revalidatePath("/admin");
}

export async function toggleUsuarioLeadsApenasPropriosAction(id: string, leadsApenasProprios: boolean) {
  const usuario = await requireUsuario();
  if (!canManageUsers(usuario.perfil)) throw new Error("Sem permissão");
  const supabase = await createClient();
  const { error } = await supabase
    .from("usuarios")
    .update({ leads_apenas_proprios: leadsApenasProprios })
    .eq("id", id);
  if (error) {
    if (/leads_apenas_proprios|schema cache/i.test(error.message)) {
      throw new Error(
        "Coluna leads_apenas_proprios ausente. Aplique a migration 027_usuarios_menus_leads_eventos.sql.",
      );
    }
    throw new Error(error.message);
  }
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/leads");
  revalidatePath("/admin");
}

export async function toggleUsuarioGoogleAgendaSyncAction(id: string, enabled: boolean) {
  const usuario = await requireUsuario();
  if (!canManageUsers(usuario.perfil)) throw new Error("Sem permissão");
  const supabase = await createClient();
  const { data: alvo } = await supabase.from("usuarios").select("email").eq("id", id).maybeSingle();
  if (!alvo) throw new Error("Usuário não encontrado");
  if (enabled && !isGmailAddress(alvo.email as string)) {
    throw new Error("Sincronização Google Agenda só está disponível para e-mails @gmail.com.");
  }

  const patch: Record<string, unknown> = { google_agenda_sync: enabled };
  if (!enabled) {
    patch.google_calendar_refresh_token = null;
    patch.google_calendar_connected_at = null;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("usuarios").update(patch).eq("id", id);
  if (error) {
    if (/google_agenda_sync|google_calendar|schema cache/i.test(error.message)) {
      throw new Error("Aplique a migration 033_google_calendar_sync.sql no Supabase.");
    }
    throw new Error(error.message);
  }
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/agenda");
}
