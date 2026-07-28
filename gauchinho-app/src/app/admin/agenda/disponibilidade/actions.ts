"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { canManageLeads, isMaster } from "@/lib/auth/permissions";
import type { DisponibilidadeConsultor, SlotDisponibilidade } from "@/lib/agenda/disponibilidade";

function normalizeTime(v: string): string {
  const t = v.trim();
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
  throw new Error(`Horário inválido: ${v}`);
}

export async function fetchMinhaDisponibilidade(): Promise<{
  slots: SlotDisponibilidade[];
  observacao: string | null;
}> {
  const u = await requireUsuario();
  if (!canManageLeads(u.perfil)) throw new Error("Sem permissão");
  const supabase = await createClient();

  const [{ data: slots, error: sErr }, { data: meta }] = await Promise.all([
    supabase
      .from("agenda_disponibilidade")
      .select("id, dia_semana, hora_inicio, hora_fim, ativo")
      .eq("usuario_id", u.id)
      .order("dia_semana")
      .order("hora_inicio"),
    supabase.from("agenda_disponibilidade_meta").select("observacao").eq("usuario_id", u.id).maybeSingle(),
  ]);

  if (sErr) {
    if (/agenda_disponibilidade|schema cache|does not exist/i.test(sErr.message)) {
      return { slots: [], observacao: null };
    }
    throw new Error(sErr.message);
  }

  return {
    slots: (slots ?? []).map((s) => ({
      id: s.id as string,
      dia_semana: Number(s.dia_semana),
      hora_inicio: String(s.hora_inicio).slice(0, 5),
      hora_fim: String(s.hora_fim).slice(0, 5),
      ativo: Boolean(s.ativo),
    })),
    observacao: (meta?.observacao as string | null) ?? null,
  };
}

export async function saveMinhaDisponibilidadeAction(formData: FormData) {
  const u = await requireUsuario();
  if (!canManageLeads(u.perfil)) throw new Error("Sem permissão");
  const supabase = await createClient();

  const observacao = String(formData.get("observacao") ?? "").trim() || null;
  const rawSlots = String(formData.get("slots_json") ?? "[]");
  let parsed: Array<{ dia_semana: number; hora_inicio: string; hora_fim: string; ativo?: boolean }>;
  try {
    parsed = JSON.parse(rawSlots) as typeof parsed;
  } catch {
    throw new Error("Dados de horários inválidos.");
  }

  const slots = parsed
    .filter((s) => s && Number.isFinite(s.dia_semana) && s.hora_inicio && s.hora_fim)
    .map((s) => {
      const inicio = normalizeTime(s.hora_inicio);
      const fim = normalizeTime(s.hora_fim);
      if (fim <= inicio) throw new Error("Horário final deve ser após o inicial.");
      return {
        usuario_id: u.id,
        dia_semana: Number(s.dia_semana),
        hora_inicio: inicio,
        hora_fim: fim,
        ativo: s.ativo !== false,
      };
    });

  const { error: delErr } = await supabase.from("agenda_disponibilidade").delete().eq("usuario_id", u.id);
  if (delErr) {
    if (/agenda_disponibilidade|schema cache|does not exist/i.test(delErr.message)) {
      throw new Error("Aplique a migration 036_agenda_disponibilidade.sql no Supabase.");
    }
    throw new Error(delErr.message);
  }

  if (slots.length) {
    const { error: insErr } = await supabase.from("agenda_disponibilidade").insert(slots);
    if (insErr) throw new Error(insErr.message);
  }

  const { error: metaErr } = await supabase.from("agenda_disponibilidade_meta").upsert(
    { usuario_id: u.id, observacao, updated_at: new Date().toISOString() },
    { onConflict: "usuario_id" },
  );
  if (metaErr && !/agenda_disponibilidade_meta|schema cache|does not exist/i.test(metaErr.message)) {
    throw new Error(metaErr.message);
  }

  revalidatePath("/admin/agenda");
  revalidatePath("/admin/agenda/disponibilidade");
}

export async function fetchDisponibilidadeConsultores(
  consultorIds?: string[],
): Promise<DisponibilidadeConsultor[]> {
  const u = await requireUsuario();
  if (!canManageLeads(u.perfil)) throw new Error("Sem permissão");
  const supabase = await createClient();

  let usuariosQ = supabase
    .from("usuarios")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
  if (consultorIds?.length) {
    usuariosQ = usuariosQ.in("id", consultorIds);
  } else {
    usuariosQ = usuariosQ.in("perfil", ["master", "srd", "visualizador"]);
  }

  const { data: usuarios, error: uErr } = await usuariosQ;
  if (uErr) throw new Error(uErr.message);
  const ids = (usuarios ?? []).map((x) => x.id as string);
  if (!ids.length) return [];

  const [{ data: slots, error: sErr }, { data: metas }] = await Promise.all([
    supabase
      .from("agenda_disponibilidade")
      .select("usuario_id, dia_semana, hora_inicio, hora_fim, ativo")
      .in("usuario_id", ids)
      .eq("ativo", true)
      .order("dia_semana")
      .order("hora_inicio"),
    supabase.from("agenda_disponibilidade_meta").select("usuario_id, observacao").in("usuario_id", ids),
  ]);

  if (sErr) {
    if (/agenda_disponibilidade|schema cache|does not exist/i.test(sErr.message)) return [];
    throw new Error(sErr.message);
  }

  const metaById = new Map<string, string | null>();
  for (const m of metas ?? []) {
    metaById.set(m.usuario_id as string, (m.observacao as string | null) ?? null);
  }

  const slotsById = new Map<string, SlotDisponibilidade[]>();
  for (const s of slots ?? []) {
    const uid = s.usuario_id as string;
    const list = slotsById.get(uid) ?? [];
    list.push({
      dia_semana: Number(s.dia_semana),
      hora_inicio: String(s.hora_inicio).slice(0, 5),
      hora_fim: String(s.hora_fim).slice(0, 5),
      ativo: Boolean(s.ativo),
    });
    slotsById.set(uid, list);
  }

  return (usuarios ?? []).map((usr) => ({
    usuarioId: usr.id as string,
    nome: usr.nome as string,
    observacao: metaById.get(usr.id as string) ?? null,
    slots: slotsById.get(usr.id as string) ?? [],
  }));
}

export async function fetchProximosCompromissosDoConsultor(limit = 5): Promise<
  Array<{
    id: string;
    titulo: string;
    data_inicio: string;
    tipo: string;
    leadNome: string | null;
  }>
> {
  const u = await requireUsuario();
  if (!canManageLeads(u.perfil)) return [];
  const supabase = await createClient();
  const now = new Date().toISOString();

  let q = supabase
    .from("agenda_compromissos")
    .select("id, titulo, data_inicio, tipo, lead_id, consultor_id")
    .eq("status", "agendado")
    .gte("data_inicio", now)
    .order("data_inicio")
    .limit(limit);

  if (!isMaster(u.perfil)) {
    q = q.eq("consultor_id", u.id);
  } else {
    q = q.eq("consultor_id", u.id);
  }

  const { data, error } = await q;
  if (error) return [];

  const leadIds = [...new Set((data ?? []).map((r) => r.lead_id).filter(Boolean))] as string[];
  const leadNames = new Map<string, string>();
  if (leadIds.length) {
    const { data: leads } = await supabase.from("leads").select("id, nome").in("id", leadIds);
    for (const l of leads ?? []) leadNames.set(l.id as string, l.nome as string);
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    titulo: r.titulo as string,
    data_inicio: r.data_inicio as string,
    tipo: r.tipo as string,
    leadNome: r.lead_id ? leadNames.get(r.lead_id as string) ?? null : null,
  }));
}
