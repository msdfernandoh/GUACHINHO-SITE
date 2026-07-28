"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { canManageImobiliarias } from "@/lib/auth/permissions";
import { slugify } from "@/lib/utils/slug";
import { uploadImagemPublica } from "@/lib/storage/imagens";
import type { EventoParticipanteRow, EventoPostRow, EventoRow, ParticipanteStatus } from "@/lib/comercial-eventos/types";
import { somarVagasUsadas, STATUS_OCUPA_VAGA } from "@/lib/comercial-eventos/vagas";
import { dbErrorMessage, isDbMissingColumnError } from "@/lib/comercial-eventos/db-ready";

function boolForm(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

function intOrNull(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function strForm(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function inscricaoFromForm(formData: FormData) {
  const tipo = strForm(formData, "inscricao_tipo") === "externo" ? "externo" : "interno";
  const url = strForm(formData, "inscricao_url_externa") || null;
  if (tipo === "externo") {
    if (!url) throw new Error("Informe o link externo de inscrição.");
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("URL inválida");
      }
    } catch {
      throw new Error("Informe uma URL externa válida (http ou https).");
    }
  }
  return { inscricao_tipo: tipo as "interno" | "externo", inscricao_url_externa: tipo === "externo" ? url : null };
}

function datetimeLocalToIso(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  // datetime-local: "YYYY-MM-DDTHH:mm" — interpreta no fuso local do servidor
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Data do evento inválida.");
  }
  return d.toISOString();
}

function eventoFromForm(
  formData: FormData,
  opts?: { preserveSlug?: string | null; forceSlug?: string | null },
) {
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) throw new Error("Nome obrigatório");
  const slugRaw = String(formData.get("slug") ?? "").trim();
  // Com QR único: o slug do evento segue o slug do QR.
  // Senão: nome e slug são independentes — alterar o nome NÃO muda o link.
  // Em edição, se o slug vier vazio, preserva o atual.
  const slug = slugify(opts?.forceSlug || slugRaw || opts?.preserveSlug || nome);
  if (!slug) throw new Error("Slug (link) inválido");
  const inscricao = inscricaoFromForm(formData);
  return {
    nome,
    slug,
    descricao_curta: String(formData.get("descricao_curta") ?? "").trim() || null,
    descricao: String(formData.get("descricao") ?? "").trim() || null,
    data_evento: datetimeLocalToIso(String(formData.get("data_evento") ?? "")),
    local: String(formData.get("local") ?? "").trim() || null,
    endereco: String(formData.get("endereco") ?? "").trim() || null,
    cidade: String(formData.get("cidade") ?? "").trim() || null,
    estado: String(formData.get("estado") ?? "").trim() || null,
    imagem_capa_url: String(formData.get("imagem_capa_url") ?? "").trim() || null,
    banner_url: String(formData.get("banner_url") ?? "").trim() || null,
    ativo: boolForm(formData, "ativo"),
    publicado: boolForm(formData, "publicado"),
    somente_por_link: boolForm(formData, "somente_por_link"),
    evento_destaque: boolForm(formData, "evento_destaque"),
    limite_participantes: intOrNull(formData, "limite_participantes"),
    permitir_acompanhante: boolForm(formData, "permitir_acompanhante"),
    exigir_convidou: boolForm(formData, "exigir_convidou"),
    mostrar_vagas: boolForm(formData, "mostrar_vagas"),
    mensagem_confirmacao: String(formData.get("mensagem_confirmacao") ?? "").trim() || null,
    observacoes_internas: String(formData.get("observacoes_internas") ?? "").trim() || null,
    // Aceita "on"/"off" explícitos (hidden do form) — nunca defaultar true se o campo faltar.
    leads_acesso_todos: (() => {
      const raw = formData.get("leads_acesso_todos");
      if (raw === "off" || raw === "false" || raw === "0") return false;
      if (raw === "on" || raw === "true" || raw === "1") return true;
      return false;
    })(),
    ...inscricao,
  };
}

const EVENTO_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function uploadEventoImagemAction(formData: FormData) {
  const u = await requireUsuario();
  if (!canManageImobiliarias(u.perfil)) throw new Error("Sem permissão");
  const kind = strForm(formData, "kind");
  if (kind !== "capa" && kind !== "banner") throw new Error("Tipo de imagem inválido");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Arquivo inválido");
  if (file.size > 5 * 1024 * 1024) throw new Error("Arquivo maior que 5 MB.");
  if (file.type && !EVENTO_IMAGE_MIME.has(file.type)) {
    throw new Error("Formato inválido. Use JPEG, PNG ou WebP.");
  }
  const slugHint = slugify(strForm(formData, "slug_hint") || "evento") || "evento";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const id = crypto.randomUUID().slice(0, 8);
  const folder = kind === "capa" ? "capas" : "banners";
  const path = `${folder}/${date}-${slugHint}-${id}`;
  return uploadImagemPublica("eventos", path, file);
}

async function syncEventoDestaque(admin: ReturnType<typeof createAdminClient>, eventoId: string, destaque: boolean) {
  if (!destaque) return;
  const { error } = await admin.from("eventos").update({ evento_destaque: false }).neq("id", eventoId);
  if (error && !isDbMissingColumnError(error)) {
    throw new Error(dbErrorMessage(error));
  }
}

const LEADS_ACESSO_MIGRATION_HINT =
  "Não foi possível salvar o acesso aos leads. Aplique a migration 027_usuarios_menus_leads_eventos.sql no Supabase.";

async function syncEventoLeadsUsuarios(
  admin: ReturnType<typeof createAdminClient>,
  eventoId: string,
  leadsAcessoTodos: boolean,
  usuarioIds: string[],
) {
  const { error: updErr } = await admin
    .from("eventos")
    .update({ leads_acesso_todos: leadsAcessoTodos })
    .eq("id", eventoId);
  if (updErr) {
    if (
      isDbMissingColumnError(updErr) ||
      /leads_acesso_todos|schema cache/i.test(dbErrorMessage(updErr))
    ) {
      throw new Error(LEADS_ACESSO_MIGRATION_HINT);
    }
    throw new Error(dbErrorMessage(updErr));
  }

  const { error: delErr } = await admin.from("eventos_leads_usuarios").delete().eq("evento_id", eventoId);
  if (delErr) {
    if (/eventos_leads_usuarios|does not exist|schema cache/i.test(dbErrorMessage(delErr))) {
      throw new Error(LEADS_ACESSO_MIGRATION_HINT);
    }
    throw new Error(dbErrorMessage(delErr));
  }
  if (!leadsAcessoTodos && usuarioIds.length) {
    const { error: insErr } = await admin.from("eventos_leads_usuarios").insert(
      usuarioIds.map((usuario_id) => ({ evento_id: eventoId, usuario_id })),
    );
    if (insErr) {
      if (/eventos_leads_usuarios|does not exist|schema cache/i.test(dbErrorMessage(insErr))) {
        throw new Error(LEADS_ACESSO_MIGRATION_HINT);
      }
      throw new Error(dbErrorMessage(insErr));
    }
  }
}

export async function fetchUsuariosStaffAtivos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nome")
    .eq("ativo", true)
    .in("perfil", ["master", "srd", "visualizador"])
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; nome: string }[];
}

export async function fetchEventoLeadsUsuariosIds(eventoId: string): Promise<string[]> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("eventos_leads_usuarios")
      .select("usuario_id")
      .eq("evento_id", eventoId);
    if (error) throw error;
    return (data ?? []).map((r) => r.usuario_id as string);
  } catch {
    return [];
  }
}

type EventoPayload = ReturnType<typeof eventoFromForm>;

const EVENTO_OPTIONAL_COLUMNS = [
  "inscricao_tipo",
  "inscricao_url_externa",
  "leads_acesso_todos",
  "evento_destaque",
  "endereco",
] as const;

async function persistEventoInsert(admin: ReturnType<typeof createAdminClient>, payload: EventoPayload) {
  let row: Record<string, unknown> = { ...payload };
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await admin.from("eventos").insert(row).select("id").single();
    if (!error && data) return data;
    if (!error) throw new Error("Falha ao criar evento.");
    if (!isDbMissingColumnError(error)) throw new Error(dbErrorMessage(error));
    const msg = dbErrorMessage(error);
    const stripped = { ...row };
    let removed = false;
    for (const key of Object.keys(stripped)) {
      if (msg.includes(key)) {
        delete stripped[key];
        removed = true;
      }
    }
    if (!removed) {
      for (const key of EVENTO_OPTIONAL_COLUMNS) {
        if (key in stripped) {
          delete stripped[key];
          removed = true;
          break;
        }
      }
    }
    if (!removed) throw new Error(msg);
    row = stripped;
  }
  throw new Error("Não foi possível criar o evento (colunas incompatíveis com o banco).");
}

async function persistEventoUpdate(admin: ReturnType<typeof createAdminClient>, id: string, payload: EventoPayload) {
  let row: Record<string, unknown> = { ...payload };
  for (let attempt = 0; attempt < 8; attempt++) {
    const { error } = await admin.from("eventos").update(row).eq("id", id);
    if (!error) return;
    if (!isDbMissingColumnError(error)) throw new Error(dbErrorMessage(error));
    const msg = dbErrorMessage(error);
    const stripped = { ...row };
    let removed = false;
    for (const key of Object.keys(stripped)) {
      if (msg.includes(key) || new RegExp(`['"]${key}['"]`, "i").test(msg)) {
        delete stripped[key];
        removed = true;
      }
    }
    // Fallback: remove optional columns that often lag behind migrations
    if (!removed) {
      for (const key of EVENTO_OPTIONAL_COLUMNS) {
        if (key in stripped) {
          delete stripped[key];
          removed = true;
          break; // remove one per attempt so we learn which column failed
        }
      }
    }
    if (!removed) throw new Error(msg);
    row = stripped;
  }
  throw new Error("Não foi possível salvar o evento (colunas incompatíveis com o banco).");
}

export async function fetchEventosAdminList(): Promise<import("@/lib/comercial-eventos/types").EventoRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("eventos").select("*").order("data_evento", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as import("@/lib/comercial-eventos/types").EventoRow[];
}

/** Lista eventos ou null se tabelas não existirem (migration pendente). */
export async function fetchEventosAdminListSafe(): Promise<
  | { ok: true; list: import("@/lib/comercial-eventos/types").EventoRow[] }
  | { ok: false; migrationMissing: true; message: string }
  | { ok: false; migrationMissing: false; message: string }
> {
  try {
    const list = await fetchEventosAdminList();
    return { ok: true, list };
  } catch (e) {
    const { isDbMissingRelationError, EVENTOS_MIGRATION_HINT } = await import("@/lib/comercial-eventos/db-ready");
    const message = e instanceof Error ? e.message : String(e);
    console.error("[admin/eventos] fetch list:", message);
    if (isDbMissingRelationError(e)) {
      return { ok: false, migrationMissing: true, message: EVENTOS_MIGRATION_HINT };
    }
    return { ok: false, migrationMissing: false, message };
  }
}

export async function fetchEventoAdmin(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("eventos").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data as EventoRow;
}

export async function fetchEventosOptionsForFilter() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("eventos").select("id, nome").order("nome");
  if (error) return [] as { id: string; nome: string }[];
  return (data ?? []) as { id: string; nome: string }[];
}

async function syncQrVinculoFromEventoForm(eventoId: string, formData: FormData) {
  const { vincularQrAoEvento, desativarVinculoQrEvento } = await import("@/lib/eventos-sorteio/qr-unico");
  const usar = formData.get("usar_qr_unico") === "on";
  const qrCodeId = strForm(formData, "qr_code_unico_id");
  const periodoInicio = strForm(formData, "qr_periodo_inicio");
  const periodoFim = strForm(formData, "qr_periodo_fim");
  if (!usar) {
    await desativarVinculoQrEvento(eventoId);
    return;
  }
  if (!qrCodeId) throw new Error("Selecione o QR Code único.");
  if (!periodoInicio || !periodoFim) {
    throw new Error("Informe o início e o fim do período de uso do QR Code.");
  }
  await vincularQrAoEvento({ qrCodeId, eventoId, periodoInicio, periodoFim });
}

/** Quando o evento usa QR único, o slug do evento = slug do QR. */
async function resolveForceSlugFromQr(formData: FormData): Promise<string | null> {
  if (formData.get("usar_qr_unico") !== "on") return null;
  const qrCodeId = strForm(formData, "qr_code_unico_id");
  if (!qrCodeId) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("qr_codes_unicos")
    .select("slug")
    .eq("id", qrCodeId)
    .maybeSingle();
  if (error) {
    if (/qr_codes_unicos|does not exist|schema cache/i.test(error.message)) return null;
    throw new Error(error.message);
  }
  return data?.slug ? String(data.slug) : null;
}

export type CreateEventoResult = { ok: true; id: string } | { ok: false; error: string };

/** Cria evento sem redirect — o form client navega após sucesso (evita erro de Server Components). */
export async function createEventoAction(formData: FormData): Promise<CreateEventoResult> {
  try {
    const u = await requireUsuario();
    if (!canManageImobiliarias(u.perfil)) {
      return { ok: false, error: "Sem permissão" };
    }
    const forceSlug = await resolveForceSlugFromQr(formData);
    const payload = eventoFromForm(formData, { forceSlug });
    const usuarioIds = formData.getAll("leads_usuario_id").map((v) => String(v).trim()).filter(Boolean);
    if (!payload.leads_acesso_todos && usuarioIds.length === 0) {
      return { ok: false, error: "Selecione ao menos um consultor com acesso aos leads do evento." };
    }
    const admin = createAdminClient();
    const data = await persistEventoInsert(admin, payload);
    await syncEventoDestaque(admin, data.id, payload.evento_destaque);
    await syncEventoLeadsUsuarios(admin, data.id, payload.leads_acesso_todos, usuarioIds);
    try {
      await syncQrVinculoFromEventoForm(data.id, formData);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/qr_codes_unicos|does not exist|schema cache/i.test(msg)) {
        return { ok: false, error: msg };
      }
    }
    revalidatePath("/admin/eventos");
    revalidatePath("/eventos");
    revalidatePath(`/admin/eventos/${data.id}`);
    revalidatePath(`/eventos/${payload.slug}`);
    revalidatePath("/admin/configuracoes/qr-codes");
    return { ok: true, id: data.id as string };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[createEventoAction]", msg);
    if (/duplicate|unique|slug/i.test(msg)) {
      return {
        ok: false,
        error: "Já existe um evento com este slug (link). Escolha outro ou use o slug do QR único.",
      };
    }
    return { ok: false, error: msg || "Não foi possível criar o evento." };
  }
}

export type UpdateEventoResult = { ok: true } | { ok: false; error: string };

/** Atualiza evento. Não usa redirect — evita erro genérico de Server Components no form client. */
export async function updateEventoAction(formData: FormData): Promise<UpdateEventoResult> {
  try {
    const u = await requireUsuario();
    if (!canManageImobiliarias(u.perfil)) {
      return { ok: false, error: "Sem permissão" };
    }
    const id = strForm(formData, "evento_id");
    if (!id) return { ok: false, error: "Evento inválido." };

    const existing = await fetchEventoAdmin(id);
    const forceSlug = await resolveForceSlugFromQr(formData);
    const payload = eventoFromForm(formData, { preserveSlug: existing.slug, forceSlug });
    const usuarioIds = formData.getAll("leads_usuario_id").map((v) => String(v).trim()).filter(Boolean);
    if (!payload.leads_acesso_todos && usuarioIds.length === 0) {
      return { ok: false, error: "Selecione ao menos um consultor com acesso aos leads do evento." };
    }
    const admin = createAdminClient();
    await persistEventoUpdate(admin, id, payload);
    await syncEventoDestaque(admin, id, payload.evento_destaque);
    await syncEventoLeadsUsuarios(admin, id, payload.leads_acesso_todos, usuarioIds);
    try {
      await syncQrVinculoFromEventoForm(id, formData);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/qr_codes_unicos|does not exist|schema cache/i.test(msg)) {
        return { ok: false, error: msg };
      }
    }
    revalidatePath("/admin/eventos");
    revalidatePath(`/admin/eventos/${id}`);
    revalidatePath("/eventos");
    revalidatePath(`/eventos/${payload.slug}`);
    if (existing.slug !== payload.slug) revalidatePath(`/eventos/${existing.slug}`);
    revalidatePath("/admin/configuracoes/qr-codes");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[updateEventoAction]", msg);
    if (/duplicate|unique|slug/i.test(msg)) {
      return {
        ok: false,
        error: "Já existe um evento com este slug (link). Escolha outro ou use o slug do QR único.",
      };
    }
    return { ok: false, error: msg || "Não foi possível salvar o evento." };
  }
}

export async function fetchParticipantesEvento(
  eventoId: string,
  filters?: { status?: string; convidou?: string; acompanhante?: string },
) {
  const supabase = await createClient();
  let q = supabase.from("eventos_participantes").select("*").eq("evento_id", eventoId).order("created_at", { ascending: false });
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.convidou?.trim()) q = q.ilike("nome_convidou", `%${filters.convidou.trim()}%`);
  if (filters?.acompanhante === "sim") q = q.eq("tem_acompanhante", true);
  if (filters?.acompanhante === "nao") q = q.eq("tem_acompanhante", false);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as EventoParticipanteRow[];
}

export async function updateParticipanteStatusAction(participanteId: string, eventoId: string, status: ParticipanteStatus) {
  const u = await requireUsuario();
  const { canManageLeads } = await import("@/lib/auth/permissions");
  if (!canManageLeads(u.perfil)) throw new Error("Sem permissão");
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "presente") patch.checkin_at = new Date().toISOString();
  const { error } = await supabase.from("eventos_participantes").update(patch).eq("id", participanteId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/eventos/${eventoId}/participantes`);
  revalidatePath(`/admin/eventos/${eventoId}/sorteio`);
}

export async function fetchEventoPosts(eventoId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("eventos_posts").select("*").eq("evento_id", eventoId).order("ordem");
  if (error) {
    const { isDbMissingRelationError } = await import("@/lib/comercial-eventos/db-ready");
    if (isDbMissingRelationError(error)) return [] as EventoPostRow[];
    throw new Error(error.message);
  }
  return (data ?? []) as EventoPostRow[];
}

export async function saveEventoPostAction(eventoId: string, formData: FormData) {
  const u = await requireUsuario();
  if (!canManageImobiliarias(u.perfil)) throw new Error("Sem permissão");
  const id = String(formData.get("post_id") ?? "").trim();
  const row = {
    evento_id: eventoId,
    titulo: String(formData.get("titulo") ?? "").trim() || null,
    conteudo: String(formData.get("conteudo") ?? "").trim() || null,
    imagem_url: String(formData.get("imagem_url") ?? "").trim() || null,
    ordem: parseInt(String(formData.get("ordem") ?? "0"), 10) || 0,
    publicado: boolForm(formData, "publicado"),
  };
  const admin = createAdminClient();
  if (id) {
    await admin.from("eventos_posts").update(row).eq("id", id);
  } else {
    await admin.from("eventos_posts").insert(row);
  }
  revalidatePath(`/admin/eventos/${eventoId}`);
  revalidatePath(`/eventos`);
}

export async function deleteEventoPostAction(eventoId: string, postId: string) {
  const u = await requireUsuario();
  if (!canManageImobiliarias(u.perfil)) throw new Error("Sem permissão");
  const admin = createAdminClient();
  await admin.from("eventos_posts").delete().eq("id", postId);
  revalidatePath(`/admin/eventos/${eventoId}`);
}

export async function eventoVagasResumo(eventoId: string, limite: number | null) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("eventos_participantes")
    .select("quantidade_vagas, status")
    .eq("evento_id", eventoId)
    .in("status", STATUS_OCUPA_VAGA);
  const usadas = somarVagasUsadas((data ?? []) as EventoParticipanteRow[]);
  return { usadas, limite, restantes: limite && limite > 0 ? Math.max(0, limite - usadas) : null };
}
