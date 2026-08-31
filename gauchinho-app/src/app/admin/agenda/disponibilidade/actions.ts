"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTenantPermission } from "@/lib/tenant/context";
import type {
  BloqueioAgenda,
  DisponibilidadeConsultor,
  ModalidadeAtendimento,
  SlotDisponibilidade,
} from "@/lib/agenda/disponibilidade";

function normalizeTime(v: string): string {
  const t = v.trim();
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
  throw new Error(`Horário inválido: ${v}`);
}

function parseModalidade(v: unknown): ModalidadeAtendimento {
  const s = String(v ?? "ambos");
  if (s === "presencial" || s === "online" || s === "ambos") return s;
  return "ambos";
}

export async function fetchMinhaDisponibilidade(): Promise<{
  slots: SlotDisponibilidade[];
  bloqueios: BloqueioAgenda[];
  observacao: string | null;
  modalidadePadrao: ModalidadeAtendimento;
}> {
  const { usuario: u, empresaAtiva } = await requireTenantPermission("acessar_agenda");
  const supabase = await createClient();

  const [{ data: slots, error: sErr }, { data: meta }, { data: bloqueios, error: bErr }] =
    await Promise.all([
      supabase
        .from("agenda_disponibilidade")
        .select("id, dia_semana, data_especifica, hora_inicio, hora_fim, ativo, modalidade_atendimento")
        .eq("empresa_id", empresaAtiva.id)
        .eq("usuario_id", u.id)
        .order("data_especifica", { ascending: true, nullsFirst: true })
        .order("dia_semana")
        .order("hora_inicio"),
      supabase
        .from("agenda_disponibilidade_meta")
        .select("observacao, modalidade_padrao")
        .eq("empresa_id", empresaAtiva.id)
        .eq("usuario_id", u.id)
        .maybeSingle(),
      supabase
        .from("agenda_bloqueios")
        .select("id, data_inicio, data_fim, hora_inicio, hora_fim, motivo")
        .eq("empresa_id", empresaAtiva.id)
        .eq("usuario_id", u.id)
        .order("data_inicio"),
    ]);

  if (sErr) {
    if (/agenda_disponibilidade|schema cache|does not exist/i.test(sErr.message)) {
      return { slots: [], bloqueios: [], observacao: null, modalidadePadrao: "ambos" };
    }
    throw new Error(sErr.message);
  }

  return {
    slots: (slots ?? []).map((s) => ({
      id: s.id as string,
      dia_semana: s.dia_semana == null ? null : Number(s.dia_semana),
      data_especifica: (s.data_especifica as string | null) ?? null,
      hora_inicio: String(s.hora_inicio).slice(0, 5),
      hora_fim: String(s.hora_fim).slice(0, 5),
      ativo: Boolean(s.ativo),
      modalidade_atendimento: parseModalidade(s.modalidade_atendimento),
    })),
    bloqueios: bErr
      ? []
      : (bloqueios ?? []).map((b) => ({
          id: b.id as string,
          data_inicio: String(b.data_inicio).slice(0, 10),
          data_fim: String(b.data_fim).slice(0, 10),
          hora_inicio: b.hora_inicio ? String(b.hora_inicio).slice(0, 5) : null,
          hora_fim: b.hora_fim ? String(b.hora_fim).slice(0, 5) : null,
          motivo: String(b.motivo ?? ""),
        })),
    observacao: (meta?.observacao as string | null) ?? null,
    modalidadePadrao: parseModalidade(meta?.modalidade_padrao),
  };
}

export async function saveMinhaDisponibilidadeAction(formData: FormData) {
  const { usuario: u, empresaAtiva } = await requireTenantPermission("acessar_agenda");
  const supabase = await createClient();

  const observacao = String(formData.get("observacao") ?? "").trim() || null;
  const modalidadePadrao = parseModalidade(formData.get("modalidade_padrao"));

  let slotsParsed: Array<{
    dia_semana?: number | null;
    data_especifica?: string | null;
    hora_inicio: string;
    hora_fim: string;
    ativo?: boolean;
    modalidade_atendimento?: string;
  }> = [];
  let bloqueiosParsed: Array<{
    data_inicio: string;
    data_fim: string;
    hora_inicio?: string | null;
    hora_fim?: string | null;
    motivo: string;
  }> = [];

  try {
    slotsParsed = JSON.parse(String(formData.get("slots_json") ?? "[]")) as typeof slotsParsed;
    bloqueiosParsed = JSON.parse(String(formData.get("bloqueios_json") ?? "[]")) as typeof bloqueiosParsed;
  } catch {
    throw new Error("Dados de disponibilidade inválidos.");
  }

  const slots = slotsParsed
    .filter((s) => s && s.hora_inicio && s.hora_fim)
    .map((s) => {
      const inicio = normalizeTime(s.hora_inicio);
      const fim = normalizeTime(s.hora_fim);
      if (fim <= inicio) throw new Error("Horário final deve ser após o inicial.");
      const dataEsp = s.data_especifica?.trim() || null;
      const dia = dataEsp ? null : s.dia_semana != null ? Number(s.dia_semana) : null;
      if (!dataEsp && (dia == null || Number.isNaN(dia))) {
        throw new Error("Informe o dia da semana ou a data específica.");
      }
      return {
        empresa_id: empresaAtiva.id,
        usuario_id: u.id,
        dia_semana: dia,
        data_especifica: dataEsp,
        hora_inicio: inicio,
        hora_fim: fim,
        ativo: s.ativo !== false,
        modalidade_atendimento: parseModalidade(s.modalidade_atendimento ?? modalidadePadrao),
      };
    });

  const bloqueios = bloqueiosParsed
    .filter((b) => b?.data_inicio && b?.data_fim && b?.motivo?.trim())
    .map((b) => {
      if (b.data_fim < b.data_inicio) throw new Error("Data final do bloqueio deve ser ≥ inicial.");
      return {
        empresa_id: empresaAtiva.id,
        usuario_id: u.id,
        data_inicio: b.data_inicio.slice(0, 10),
        data_fim: b.data_fim.slice(0, 10),
        hora_inicio: b.hora_inicio ? normalizeTime(b.hora_inicio) : null,
        hora_fim: b.hora_fim ? normalizeTime(b.hora_fim) : null,
        motivo: b.motivo.trim(),
      };
    });

  const { error: delErr } = await supabase.from("agenda_disponibilidade").delete().eq("empresa_id", empresaAtiva.id).eq("usuario_id", u.id);
  if (delErr) {
    if (/agenda_disponibilidade|schema cache|does not exist/i.test(delErr.message)) {
      throw new Error("Aplique as migrations 036 e 037 de disponibilidade no Supabase.");
    }
    throw new Error(delErr.message);
  }

  if (slots.length) {
    const { error: insErr } = await supabase.from("agenda_disponibilidade").insert(slots);
    if (insErr) {
      if (/data_especifica|modalidade_atendimento|schema cache/i.test(insErr.message)) {
        throw new Error("Aplique a migration 037_agenda_disponibilidade_datas_bloqueios.sql no Supabase.");
      }
      throw new Error(insErr.message);
    }
  }

  await supabase.from("agenda_bloqueios").delete().eq("empresa_id", empresaAtiva.id).eq("usuario_id", u.id);
  if (bloqueios.length) {
    const { error: bErr } = await supabase.from("agenda_bloqueios").insert(bloqueios);
    if (bErr && !/agenda_bloqueios|schema cache|does not exist/i.test(bErr.message)) {
      throw new Error(bErr.message);
    }
    if (bErr && /agenda_bloqueios|does not exist/i.test(bErr.message)) {
      throw new Error("Aplique a migration 037 (tabela agenda_bloqueios) no Supabase.");
    }
  }

  const { error: metaErr } = await supabase.from("agenda_disponibilidade_meta").upsert(
    {
      empresa_id: empresaAtiva.id,
      usuario_id: u.id,
      observacao,
      modalidade_padrao: modalidadePadrao,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "empresa_id,usuario_id" },
  );
  if (metaErr && !/agenda_disponibilidade_meta|schema cache|does not exist|modalidade_padrao/i.test(metaErr.message)) {
    throw new Error(metaErr.message);
  }
  if (metaErr && /modalidade_padrao/i.test(metaErr.message)) {
    await supabase.from("agenda_disponibilidade_meta").upsert(
      { empresa_id: empresaAtiva.id, usuario_id: u.id, observacao, updated_at: new Date().toISOString() },
      { onConflict: "empresa_id,usuario_id" },
    );
  }

  revalidatePath("/admin/agenda");
  revalidatePath("/admin/agenda/disponibilidade");
}

export async function fetchDisponibilidadeConsultores(
  consultorIds?: string[],
): Promise<DisponibilidadeConsultor[]> {
  const { empresaAtiva } = await requireTenantPermission("acessar_agenda");
  const supabase = await createClient();

  let usuariosQ = supabase.from("empresa_usuarios")
    .select("usuario:usuarios!empresa_usuarios_usuario_id_fkey(id,nome,ativo)")
    .eq("empresa_id", empresaAtiva.id).eq("ativo", true);
  if (consultorIds?.length) usuariosQ = usuariosQ.in("usuario_id", consultorIds);
  const { data: vinculos, error: uErr } = await usuariosQ;
  if (uErr) throw new Error(uErr.message);
  const usuarios = (vinculos ?? []).flatMap((v) => {
    const usr = Array.isArray(v.usuario) ? v.usuario[0] : v.usuario;
    return usr?.ativo ? [usr] : [];
  });
  const ids = (usuarios ?? []).map((x) => x.id as string);
  if (!ids.length) return [];

  const [{ data: slots, error: sErr }, { data: metas }, { data: bloqueios }] = await Promise.all([
    supabase
      .from("agenda_disponibilidade")
      .select("usuario_id, dia_semana, data_especifica, hora_inicio, hora_fim, ativo, modalidade_atendimento")
      .eq("empresa_id", empresaAtiva.id)
      .in("usuario_id", ids)
      .eq("ativo", true)
      .order("dia_semana")
      .order("hora_inicio"),
    supabase
      .from("agenda_disponibilidade_meta")
      .select("usuario_id, observacao, modalidade_padrao")
      .eq("empresa_id", empresaAtiva.id)
      .in("usuario_id", ids),
    supabase
      .from("agenda_bloqueios")
      .select("usuario_id, data_inicio, data_fim, hora_inicio, hora_fim, motivo")
      .eq("empresa_id", empresaAtiva.id)
      .in("usuario_id", ids)
      .order("data_inicio"),
  ]);

  if (sErr) {
    if (/agenda_disponibilidade|schema cache|does not exist/i.test(sErr.message)) return [];
    throw new Error(sErr.message);
  }

  const metaById = new Map<string, { observacao: string | null; modalidade: ModalidadeAtendimento }>();
  for (const m of metas ?? []) {
    metaById.set(m.usuario_id as string, {
      observacao: (m.observacao as string | null) ?? null,
      modalidade: parseModalidade(m.modalidade_padrao),
    });
  }

  const slotsById = new Map<string, SlotDisponibilidade[]>();
  for (const s of slots ?? []) {
    const uid = s.usuario_id as string;
    const list = slotsById.get(uid) ?? [];
    list.push({
      dia_semana: s.dia_semana == null ? null : Number(s.dia_semana),
      data_especifica: (s.data_especifica as string | null) ?? null,
      hora_inicio: String(s.hora_inicio).slice(0, 5),
      hora_fim: String(s.hora_fim).slice(0, 5),
      ativo: Boolean(s.ativo),
      modalidade_atendimento: parseModalidade(s.modalidade_atendimento),
    });
    slotsById.set(uid, list);
  }

  const bloqueiosById = new Map<string, BloqueioAgenda[]>();
  for (const b of bloqueios ?? []) {
    const uid = b.usuario_id as string;
    const list = bloqueiosById.get(uid) ?? [];
    list.push({
      data_inicio: String(b.data_inicio).slice(0, 10),
      data_fim: String(b.data_fim).slice(0, 10),
      hora_inicio: b.hora_inicio ? String(b.hora_inicio).slice(0, 5) : null,
      hora_fim: b.hora_fim ? String(b.hora_fim).slice(0, 5) : null,
      motivo: String(b.motivo ?? ""),
    });
    bloqueiosById.set(uid, list);
  }

  return (usuarios ?? []).map((usr) => {
    const meta = metaById.get(usr.id as string);
    return {
      usuarioId: usr.id as string,
      nome: usr.nome as string,
      observacao: meta?.observacao ?? null,
      modalidadePadrao: meta?.modalidade ?? "ambos",
      slots: slotsById.get(usr.id as string) ?? [],
      bloqueios: bloqueiosById.get(usr.id as string) ?? [],
    };
  });
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
  const { usuario: u, empresaAtiva } = await requireTenantPermission("acessar_agenda");
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("agenda_compromissos")
    .select("id, titulo, data_inicio, tipo, lead_id, consultor_id")
    .eq("empresa_id", empresaAtiva.id)
    .eq("status", "agendado")
    .eq("consultor_id", u.id)
    .gte("data_inicio", now)
    .order("data_inicio")
    .limit(limit);

  if (error) return [];

  const leadIds = [...new Set((data ?? []).map((r) => r.lead_id).filter(Boolean))] as string[];
  const leadNames = new Map<string, string>();
  if (leadIds.length) {
    const { data: leads } = await supabase.from("leads").select("id, nome").eq("empresa_id", empresaAtiva.id).in("id", leadIds);
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
