"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { canManageUsers, PERFIS } from "@/lib/auth/permissions";
import type { AdminMenuKey } from "@/lib/admin/admin-menus";
import { isGmailAddress } from "@/lib/google-calendar/config";
import { clearGoogleRefreshToken } from "@/lib/google-calendar/token-store";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { normalizeErpAccessIds } from "@/lib/erp/erp-acesso";
import { isMissingErpUserLinkColumns } from "@/lib/erp/migration-077-compat";

function redirectUsuarios(codigo: string): never {
  redirect(`/admin/usuarios?flash=${encodeURIComponent(codigo)}`);
}

export async function fetchUsuarios() {
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) return [];
  const admin = createAdminClient();
  const usuarioSelect = "usuario:usuarios(id,auth_user_id,nome,email,telefone,perfil,ativo,is_consultor,leads_apenas_proprios,agenda_acesso_todos,google_agenda_sync,google_calendar_connected_at,google_calendar_email,admin_menus,created_at)";
  const extended = await admin
    .from("empresa_usuarios")
    .select(`socio_pagador,erp_modulos_visiveis,${usuarioSelect}`)
    .eq("empresa_id", empresaAtiva.id)
    .eq("ativo", true);
  if (!extended.error) {
    return (extended.data ?? []).flatMap((link) => {
      const usuario = Array.isArray(link.usuario) ? link.usuario[0] : link.usuario;
      return usuario ? [{ ...usuario, socio_pagador: Boolean(link.socio_pagador), erp_modulos_visiveis: link.erp_modulos_visiveis }] : [];
    }).sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  }
  if (!isMissingErpUserLinkColumns(extended.error)) throw new Error(extended.error.message);

  const legacy = await admin
    .from("empresa_usuarios")
    .select(usuarioSelect)
    .eq("empresa_id", empresaAtiva.id)
    .eq("ativo", true);
  if (legacy.error) throw new Error(legacy.error.message);
  return (legacy.data ?? []).flatMap((link) => {
    const usuario = Array.isArray(link.usuario) ? link.usuario[0] : link.usuario;
    return usuario ? [{ ...usuario, socio_pagador: false, erp_modulos_visiveis: null }] : [];
  }).sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
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
  const agendaAcessoTodos = formData.get("agenda_acesso_todos") === "on";
  const googleAgendaSync = formData.get("google_agenda_sync") === "on";
  const menuKeys = formData.getAll("admin_menu").map((v) => String(v).trim()) as AdminMenuKey[];
  const adminMenus = menuKeys.length ? menuKeys : null;
  const socioPagador = formData.get("socio_pagador") === "on";
  const erpMenus = normalizeErpAccessIds(formData.getAll("erp_menu").map(String)) ?? [];
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) throw new Error("Empresa ativa não encontrada");

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
    agenda_acesso_todos: agendaAcessoTodos,
    google_agenda_sync: googleAgendaSync && isGmailAddress(email),
    admin_menus: adminMenus,
  });
  if (
    error &&
    /is_consultor|admin_menus|leads_apenas_proprios|agenda_acesso_todos|google_agenda_sync/.test(error.message)
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
      { ...base, is_consultor: isConsultor, leads_apenas_proprios: leadsApenasProprios, agenda_acesso_todos: agendaAcessoTodos, google_agenda_sync: googleAgendaSync && isGmailAddress(email) },
      { ...base, leads_apenas_proprios: leadsApenasProprios, agenda_acesso_todos: agendaAcessoTodos, google_agenda_sync: googleAgendaSync && isGmailAddress(email) },
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

  const { data: usuarioCriado, error: usuarioErr } = await admin
    .from("usuarios")
    .select("id")
    .eq("auth_user_id", authUser.user.id)
    .single();
  if (usuarioErr || !usuarioCriado) throw new Error(usuarioErr?.message ?? "Usuário não encontrado após criação");
  const roleCode = perfil === "master"
    ? "admin_empresa"
    : perfil === "visualizador"
      ? "visualizador"
      : perfil === "imobiliaria"
        ? "parceiro_imobiliaria"
        : "consultor";
  const { data: papel, error: papelErr } = await admin.from("papeis").select("id").eq("codigo", roleCode).is("empresa_id", null).single();
  if (papelErr || !papel) throw new Error(papelErr?.message ?? "Papel do usuário não encontrado");
  const vinculoBase = {
    empresa_id: empresaAtiva.id,
    usuario_id: usuarioCriado.id,
    papel_id: papel.id,
    ativo: true,
    convidado_por: usuario.id,
    origem: "ERP_USUARIOS",
  };
  const { error: vinculoErr } = await admin.from("empresa_usuarios").insert({
    ...vinculoBase,
    socio_pagador: socioPagador,
    erp_modulos_visiveis: erpMenus,
  });
  if (vinculoErr) {
    if (!isMissingErpUserLinkColumns(vinculoErr)) throw new Error(vinculoErr.message);
    const { error: legacyVinculoErr } = await admin.from("empresa_usuarios").insert(vinculoBase);
    if (legacyVinculoErr) throw new Error(legacyVinculoErr.message);
    revalidatePath("/admin/usuarios");
    redirectUsuarios("erp_permissoes_pendentes");
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

/** Master — dados cadastrais, perfil, menus e opções comerciais. */
export async function updateUsuarioEdicaoAction(formData: FormData) {
  const current = await requireUsuario();
  if (!canManageUsers(current.perfil)) redirectUsuarios("sem_permissao");

  const id = String(formData.get("usuario_id") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const emailNovo = String(formData.get("email") ?? "").trim().toLowerCase();
  const telefone = String(formData.get("telefone") ?? "").trim() || null;
  const perfil = String(formData.get("perfil") ?? "").trim();
  const novaSenha = String(formData.get("nova_senha") ?? "").trim();

  if (!id || !nome || !emailNovo || !emailNovo.includes("@")) redirectUsuarios("invalido");
  if (!PERFIS.includes(perfil as (typeof PERFIS)[number])) redirectUsuarios("invalido");
  if (novaSenha && novaSenha.length < 8) redirectUsuarios("senha_curta");

  const isConsultor = formData.get("is_consultor") === "on";
  const leadsApenasProprios = formData.get("leads_apenas_proprios") === "on";
  const agendaAcessoTodos = formData.get("agenda_acesso_todos") === "on";
  const googleAgendaSyncRequested = formData.get("google_agenda_sync") === "on";
  const menuKeys = formData.getAll("admin_menu").map((v) => String(v).trim()) as AdminMenuKey[];
  const adminMenus = menuKeys.length ? menuKeys : null;
  const socioPagador = formData.get("socio_pagador") === "on";
  const erpMenus = normalizeErpAccessIds(formData.getAll("erp_menu").map(String)) ?? [];

  const admin = createAdminClient();
  const { data: alvo, error: loadErr } = await admin
    .from("usuarios")
    .select("id, email, auth_user_id")
    .eq("id", id)
    .maybeSingle();
  if (loadErr) redirectUsuarios("generico");
  if (!alvo) redirectUsuarios("nao_encontrado");

  const emailAnterior = String(alvo.email ?? "").trim().toLowerCase();
  const emailMudou = emailNovo !== emailAnterior;

  const googleAgendaSync = googleAgendaSyncRequested && isGmailAddress(emailNovo);
  if (googleAgendaSyncRequested && !googleAgendaSync) redirectUsuarios("sem_gmail");

  const authUserId = alvo.auth_user_id as string | null;
  if (authUserId && (emailMudou || novaSenha)) {
    const authPatch: { email?: string; password?: string; email_confirm?: boolean } = {};
    if (emailMudou) {
      authPatch.email = emailNovo;
      authPatch.email_confirm = true;
    }
    if (novaSenha) authPatch.password = novaSenha;
    const { error: authErr } = await admin.auth.admin.updateUserById(authUserId, authPatch);
    if (authErr) redirectUsuarios("auth");
  }

  const avisos: string[] = [];

  const corePatch = { nome, email: emailNovo, telefone, perfil };
  const { error: coreErr } = await admin.from("usuarios").update(corePatch).eq("id", id);
  if (coreErr) redirectUsuarios("generico");

  const extrasPatch: Record<string, unknown> = {
    is_consultor: isConsultor,
    leads_apenas_proprios: leadsApenasProprios,
    agenda_acesso_todos: agendaAcessoTodos,
    admin_menus: adminMenus,
  };
  const { error: extrasErr } = await admin.from("usuarios").update(extrasPatch).eq("id", id);
  if (extrasErr) {
    if (/admin_menus|is_consultor|leads_apenas_proprios|agenda_acesso_todos|schema cache/i.test(extrasErr.message)) {
      avisos.push("menus_parcial");
    } else {
      redirectUsuarios("generico");
    }
  }

  const googlePatch: Record<string, unknown> = { google_agenda_sync: googleAgendaSync };
  if (!googleAgendaSync || emailMudou) {
    googlePatch.google_calendar_connected_at = null;
    googlePatch.google_calendar_email = null;
    await clearGoogleRefreshToken(id);
    if (!isGmailAddress(emailNovo)) {
      googlePatch.google_agenda_sync = false;
    }
  }

  let { error: googleErr } = await admin.from("usuarios").update(googlePatch).eq("id", id);
  if (googleErr && /google_calendar_connected_at|google_calendar_email/.test(googleErr.message)) {
    ({ error: googleErr } = await admin
      .from("usuarios")
      .update({ google_agenda_sync: googlePatch.google_agenda_sync })
      .eq("id", id));
  }
  if (googleErr) {
    if (/google_agenda_sync|google_calendar|schema cache/i.test(googleErr.message)) {
      avisos.push("google_parcial");
    } else {
      redirectUsuarios("generico");
    }
  }

  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) redirectUsuarios("generico");
  const { error: vinculoErr } = await admin
    .from("empresa_usuarios")
    .update({ socio_pagador: socioPagador, erp_modulos_visiveis: erpMenus })
    .eq("empresa_id", empresaAtiva.id)
    .eq("usuario_id", id)
    .eq("ativo", true);
  if (vinculoErr) {
    if (isMissingErpUserLinkColumns(vinculoErr)) {
      avisos.push("erp_permissoes_pendentes");
    } else {
      redirectUsuarios("generico");
    }
  }

  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/leads");
  revalidatePath("/admin/agenda");
  revalidatePath("/admin");

  if (avisos.includes("google_parcial")) redirectUsuarios("google_parcial");
  if (avisos.includes("menus_parcial")) redirectUsuarios("menus_parcial");
  if (avisos.includes("erp_permissoes_pendentes")) redirectUsuarios("erp_permissoes_pendentes");
  redirectUsuarios("salvo");
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
    patch.google_calendar_connected_at = null;
    patch.google_calendar_email = null;
    await clearGoogleRefreshToken(id);
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
