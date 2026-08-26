"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { PERFIS } from "@/lib/auth/permissions";
import type { AdminMenuKey } from "@/lib/admin/admin-menus";
import { isGmailAddress } from "@/lib/google-calendar/config";
import { requireTenantPermission } from "@/lib/tenant/context";
import { normalizeErpAccessIds } from "@/lib/erp/erp-acesso";
import { isMissingErpUserLinkColumns } from "@/lib/erp/migration-077-compat";

function redirectUsuarios(codigo: string): never {
  redirect(`/admin/usuarios?flash=${encodeURIComponent(codigo)}`);
}

const PERFIL_PARA_PAPEL = {
  master: "admin_empresa",
  srd: "consultor",
  imobiliaria: "parceiro_imobiliaria",
  visualizador: "visualizador",
} as const;

async function resolvePapelId(
  admin: ReturnType<typeof createAdminClient>,
  empresaId: string,
  perfil: keyof typeof PERFIL_PARA_PAPEL,
): Promise<string> {
  const codigo = PERFIL_PARA_PAPEL[perfil];
  const { data, error } = await admin
    .from("papeis")
    .select("id,empresa_id")
    .eq("codigo", codigo)
    .eq("escopo", "COMPANY")
    .or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
  if (error) throw new Error(error.message);
  const papel = (data ?? []).sort((a, b) => Number(Boolean(b.empresa_id)) - Number(Boolean(a.empresa_id)))[0];
  if (!papel) throw new Error(`Papel ${codigo} não encontrado para a empresa`);
  return papel.id;
}

async function requireUsuarioDaEmpresa(
  admin: ReturnType<typeof createAdminClient>,
  empresaId: string,
  usuarioId: string,
) {
  const { data, error } = await admin
    .from("empresa_usuarios")
    .select("id,empresa_id,usuario_id,papel_id,ativo")
    .eq("empresa_id", empresaId)
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Usuário não pertence à empresa deste domínio");
  return data;
}

export async function fetchUsuarios() {
  const { empresaAtiva } = await requireTenantPermission("gerenciar_usuarios");
  const admin = createAdminClient();
  const usuarioSelect = "usuario:usuarios!empresa_usuarios_usuario_id_fkey(id,auth_user_id,nome,email,telefone,perfil,ativo,is_consultor,leads_apenas_proprios,agenda_acesso_todos,google_agenda_sync,google_calendar_connected_at,google_calendar_email,admin_menus,created_at)";
  const extended = await admin
    .from("empresa_usuarios")
    .select(`id,ativo,papel:papeis(codigo,nome),socio_pagador,pode_estornar_contas,is_consultor,leads_apenas_proprios,agenda_acesso_todos,google_agenda_sync,admin_menus,erp_modulos_visiveis,${usuarioSelect}`)
    .eq("empresa_id", empresaAtiva.id);
  if (!extended.error) {
    return (extended.data ?? []).flatMap((link) => {
      const usuario = Array.isArray(link.usuario) ? link.usuario[0] : link.usuario;
      const papel = (Array.isArray(link.papel) ? link.papel[0] : link.papel) as
        | { codigo?: string; nome?: string }
        | null;
      return usuario
        ? [
            {
              ...usuario,
              ativo: Boolean(link.ativo),
              usuario_ativo: Boolean(usuario.ativo),
              papel_codigo: papel?.codigo,
              papel_nome: papel?.nome,
              is_consultor: link.is_consultor ?? usuario.is_consultor,
              leads_apenas_proprios:
                link.leads_apenas_proprios ?? usuario.leads_apenas_proprios,
              agenda_acesso_todos:
                link.agenda_acesso_todos ?? usuario.agenda_acesso_todos,
              google_agenda_sync: link.google_agenda_sync ?? usuario.google_agenda_sync,
              admin_menus: link.admin_menus ?? usuario.admin_menus,
              socio_pagador: Boolean(link.socio_pagador),
              pode_estornar_contas: Boolean((link as { pode_estornar_contas?: boolean }).pode_estornar_contas),
              erp_modulos_visiveis: link.erp_modulos_visiveis,
            },
          ]
        : [];
    }).sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  }
  if (!isMissingErpUserLinkColumns(extended.error)) throw new Error(extended.error.message);

  const legacy = await admin
    .from("empresa_usuarios")
    .select(`id,ativo,papel:papeis(codigo,nome),${usuarioSelect}`)
    .eq("empresa_id", empresaAtiva.id);
  if (legacy.error) throw new Error(legacy.error.message);
  return (legacy.data ?? []).flatMap((link) => {
    const usuario = Array.isArray(link.usuario) ? link.usuario[0] : link.usuario;
    const papel = (Array.isArray(link.papel) ? link.papel[0] : link.papel) as
      | { codigo?: string; nome?: string }
      | null;
    return usuario ? [{
      ...usuario,
      ativo: Boolean(link.ativo),
      usuario_ativo: Boolean(usuario.ativo),
      papel_codigo: papel?.codigo,
      papel_nome: papel?.nome,
      socio_pagador: false,
      pode_estornar_contas: false,
      erp_modulos_visiveis: null,
    }] : [];
  }).sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
}

export async function createUsuarioAction(formData: FormData) {
  const { usuario, empresaAtiva } = await requireTenantPermission("gerenciar_usuarios");
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
  const podeEstornarContas = formData.get("pode_estornar_contas") === "on";
  const erpMenus = normalizeErpAccessIds(formData.getAll("erp_menu").map(String)) ?? [];

  if (!nome || !email.includes("@") || password.length < 8) {
    throw new Error("Nome, e-mail válido e senha de pelo menos 8 caracteres são obrigatórios");
  }
  if (!PERFIS.includes(perfil as (typeof PERFIS)[number])) throw new Error("Perfil inválido");

  const admin = createAdminClient();
  const papelId = await resolvePapelId(
    admin,
    empresaAtiva.id,
    perfil as keyof typeof PERFIL_PARA_PAPEL,
  );
  const { data: existente, error: existenteErr } = await admin
    .from("usuarios")
    .select("id,auth_user_id,ativo")
    .ilike("email", email)
    .maybeSingle();
  if (existenteErr) throw new Error(existenteErr.message);
  if (existente && !existente.ativo) {
    throw new Error("Esta identidade está inativa na plataforma; solicite a reativação ao administrador da plataforma");
  }

  let authUserId = existente?.auth_user_id ?? null;
  let usuarioCriadoId = existente?.id ?? null;
  let criouIdentidade = false;

  try {
    if (!usuarioCriadoId) {
      const { data: authUser, error: authError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (authError) throw new Error(authError.message);
      authUserId = authUser.user.id;

      const { data: usuarioCriado, error: usuarioErr } = await admin
        .from("usuarios")
        .insert({
          auth_user_id: authUserId,
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
        })
        .select("id")
        .single();
      if (usuarioErr || !usuarioCriado) {
        await admin.auth.admin.deleteUser(authUserId);
        throw new Error(usuarioErr?.message ?? "Falha ao criar identidade de negócio");
      }
      usuarioCriadoId = usuarioCriado.id;
      criouIdentidade = true;
    }

    if (!authUserId || !usuarioCriadoId) throw new Error("Identidade sem vínculo de autenticação válido");

    const { data: vinculoExistente, error: vinculoLoadErr } = await admin
      .from("empresa_usuarios")
      .select("id,ativo")
      .eq("empresa_id", empresaAtiva.id)
      .eq("usuario_id", usuarioCriadoId)
      .maybeSingle();
    if (vinculoLoadErr) throw new Error(vinculoLoadErr.message);
    if (vinculoExistente?.ativo) throw new Error("Usuário já possui vínculo ativo com esta empresa");

    const vinculoBase = {
      empresa_id: empresaAtiva.id,
      usuario_id: usuarioCriadoId,
      papel_id: papelId,
      ativo: true,
      convidado_por: usuario.id,
      origem: "ERP_USUARIOS",
      socio_pagador: socioPagador,
      pode_estornar_contas: podeEstornarContas,
      erp_modulos_visiveis: erpMenus,
      is_consultor: isConsultor,
      leads_apenas_proprios: leadsApenasProprios,
      agenda_acesso_todos: agendaAcessoTodos,
      google_agenda_sync: googleAgendaSync && isGmailAddress(email),
      admin_menus: adminMenus,
    };
    const vinculoQuery = vinculoExistente
      ? admin.from("empresa_usuarios").update(vinculoBase).eq("id", vinculoExistente.id)
      : admin.from("empresa_usuarios").insert(vinculoBase);
    const { error: vinculoErr } = await vinculoQuery;
    if (vinculoErr) throw new Error(vinculoErr.message);
  } catch (error) {
    if (criouIdentidade && usuarioCriadoId && authUserId) {
      await admin.from("usuarios").delete().eq("id", usuarioCriadoId);
      await admin.auth.admin.deleteUser(authUserId);
    }
    throw error;
  }

  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios");
}

export async function toggleUsuarioAtivoAction(id: string, ativo: boolean) {
  const { empresaAtiva } = await requireTenantPermission("gerenciar_usuarios");
  const admin = createAdminClient();
  const vinculo = await requireUsuarioDaEmpresa(admin, empresaAtiva.id, id);
  const { error } = await admin
    .from("empresa_usuarios")
    .update({ ativo })
    .eq("id", vinculo.id)
    .eq("empresa_id", empresaAtiva.id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/usuarios");
}

export async function toggleUsuarioConsultorAction(id: string, isConsultor: boolean) {
  const { empresaAtiva } = await requireTenantPermission("gerenciar_usuarios");
  const admin = createAdminClient();
  await requireUsuarioDaEmpresa(admin, empresaAtiva.id, id);
  const { error } = await admin
    .from("empresa_usuarios")
    .update({ is_consultor: isConsultor })
    .eq("empresa_id", empresaAtiva.id)
    .eq("usuario_id", id);
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
  const { empresaAtiva } = await requireTenantPermission("gerenciar_usuarios");

  const id = String(formData.get("usuario_id") ?? "").trim();
  const perfil = String(formData.get("perfil") ?? "").trim();

  if (!id) redirectUsuarios("invalido");
  if (!PERFIS.includes(perfil as (typeof PERFIS)[number])) redirectUsuarios("invalido");

  const isConsultor = formData.get("is_consultor") === "on";
  const leadsApenasProprios = formData.get("leads_apenas_proprios") === "on";
  const agendaAcessoTodos = formData.get("agenda_acesso_todos") === "on";
  const googleAgendaSyncRequested = formData.get("google_agenda_sync") === "on";
  const menuKeys = formData.getAll("admin_menu").map((v) => String(v).trim()) as AdminMenuKey[];
  const adminMenus = menuKeys.length ? menuKeys : null;
  const socioPagador = formData.get("socio_pagador") === "on";
  const podeEstornarContas = formData.get("pode_estornar_contas") === "on";
  const erpMenus = normalizeErpAccessIds(formData.getAll("erp_menu").map(String)) ?? [];

  const admin = createAdminClient();
  const { data: vinculoAlvo, error: vinculoLoadErr } = await admin
    .from("empresa_usuarios")
    .select("id,usuario:usuarios!empresa_usuarios_usuario_id_fkey(id,email)")
    .eq("empresa_id", empresaAtiva.id)
    .eq("usuario_id", id)
    .maybeSingle();
  if (vinculoLoadErr) redirectUsuarios("generico");
  const alvo = Array.isArray(vinculoAlvo?.usuario) ? vinculoAlvo.usuario[0] : vinculoAlvo?.usuario;
  if (!vinculoAlvo || !alvo) redirectUsuarios("nao_encontrado");

  const emailIdentidade = String(alvo.email ?? "").trim().toLowerCase();
  const googleAgendaSync = googleAgendaSyncRequested && isGmailAddress(emailIdentidade);
  if (googleAgendaSyncRequested && !googleAgendaSync) redirectUsuarios("sem_gmail");

  const avisos: string[] = [];

  const papelId = await resolvePapelId(
    admin,
    empresaAtiva.id,
    perfil as keyof typeof PERFIL_PARA_PAPEL,
  );
  const { error: vinculoErr } = await admin
    .from("empresa_usuarios")
    .update({
      papel_id: papelId,
      socio_pagador: socioPagador,
      pode_estornar_contas: podeEstornarContas,
      is_consultor: isConsultor,
      leads_apenas_proprios: leadsApenasProprios,
      agenda_acesso_todos: agendaAcessoTodos,
      google_agenda_sync: googleAgendaSync,
      admin_menus: adminMenus,
      erp_modulos_visiveis: erpMenus,
    })
    .eq("empresa_id", empresaAtiva.id)
    .eq("usuario_id", id)
    .eq("id", vinculoAlvo.id);
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

  if (avisos.includes("menus_parcial")) redirectUsuarios("menus_parcial");
  if (avisos.includes("erp_permissoes_pendentes")) redirectUsuarios("erp_permissoes_pendentes");
  redirectUsuarios("salvo");
}

export async function toggleUsuarioLeadsApenasPropriosAction(id: string, leadsApenasProprios: boolean) {
  const { empresaAtiva } = await requireTenantPermission("gerenciar_usuarios");
  const admin = createAdminClient();
  await requireUsuarioDaEmpresa(admin, empresaAtiva.id, id);
  const { error } = await admin
    .from("empresa_usuarios")
    .update({ leads_apenas_proprios: leadsApenasProprios })
    .eq("empresa_id", empresaAtiva.id)
    .eq("usuario_id", id);
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
  const { empresaAtiva } = await requireTenantPermission("gerenciar_usuarios");
  const admin = createAdminClient();
  await requireUsuarioDaEmpresa(admin, empresaAtiva.id, id);
  const { data: alvo } = await admin.from("usuarios").select("email").eq("id", id).maybeSingle();
  if (!alvo) throw new Error("Usuário não encontrado");
  if (enabled && !isGmailAddress(alvo.email as string)) {
    throw new Error("Sincronização Google Agenda só está disponível para e-mails @gmail.com.");
  }

  const patch: Record<string, unknown> = { google_agenda_sync: enabled };
  if (!enabled) {
    // O token pertence à identidade global e pode estar em uso por outra empresa.
    // Desabilitar neste vínculo não revoga a conexão global.
  }

  const { error } = await admin
    .from("empresa_usuarios")
    .update(patch)
    .eq("empresa_id", empresaAtiva.id)
    .eq("usuario_id", id);
  if (error) {
    if (/google_agenda_sync|google_calendar|schema cache/i.test(error.message)) {
      throw new Error("Aplique a migration 033_google_calendar_sync.sql no Supabase.");
    }
    throw new Error(error.message);
  }
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/agenda");
}
