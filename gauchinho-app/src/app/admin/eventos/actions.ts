"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { canManageImobiliarias } from "@/lib/auth/permissions";
import { slugify } from "@/lib/utils/slug";
import type { EventoParticipanteRow, EventoPostRow, EventoRow, ParticipanteStatus } from "@/lib/comercial-eventos/types";
import { somarVagasUsadas, STATUS_OCUPA_VAGA } from "@/lib/comercial-eventos/vagas";

function boolForm(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

function intOrNull(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function eventoFromForm(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) throw new Error("Nome obrigatório");
  return {
    nome,
    slug: slugify(String(formData.get("slug") ?? nome)),
    descricao_curta: String(formData.get("descricao_curta") ?? "").trim() || null,
    descricao: String(formData.get("descricao") ?? "").trim() || null,
    data_evento: String(formData.get("data_evento") ?? "").trim() || null,
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
  };
}

async function syncEventoDestaque(admin: ReturnType<typeof createAdminClient>, eventoId: string, destaque: boolean) {
  if (!destaque) return;
  await admin.from("eventos").update({ evento_destaque: false }).neq("id", eventoId);
}

export async function fetchEventosAdminList() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("eventos").select("*").order("data_evento", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as EventoRow[];
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

export async function createEventoAction(formData: FormData) {
  const u = await requireUsuario();
  if (!canManageImobiliarias(u.perfil)) throw new Error("Sem permissão");
  const payload = eventoFromForm(formData);
  const admin = createAdminClient();
  const { data, error } = await admin.from("eventos").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  await syncEventoDestaque(admin, data.id, payload.evento_destaque);
  revalidatePath("/admin/eventos");
  revalidatePath("/eventos");
  redirect(`/admin/eventos/${data.id}`);
}

export async function updateEventoAction(id: string, formData: FormData) {
  const u = await requireUsuario();
  if (!canManageImobiliarias(u.perfil)) throw new Error("Sem permissão");
  const payload = eventoFromForm(formData);
  const admin = createAdminClient();
  const { error } = await admin.from("eventos").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
  await syncEventoDestaque(admin, id, payload.evento_destaque);
  revalidatePath("/admin/eventos");
  revalidatePath(`/admin/eventos/${id}`);
  revalidatePath("/eventos");
  revalidatePath(`/eventos/${payload.slug}`);
  redirect(`/admin/eventos/${id}`);
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
}

export async function fetchEventoPosts(eventoId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("eventos_posts").select("*").eq("evento_id", eventoId).order("ordem");
  if (error) throw new Error(error.message);
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
