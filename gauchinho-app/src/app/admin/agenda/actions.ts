"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { canManageLeads, isMaster } from "@/lib/auth/permissions";
import type { AgendaCompromissoRow, AgendaResultado, AgendaStatus } from "@/lib/agenda/types";
import { AGENDA_RESULTADOS } from "@/lib/agenda/types";

function parseDateTimeLocal(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export async function fetchCompromissosRange(fromIso: string, toIso: string, consultorId?: string) {
  const u = await requireUsuario();
  if (!canManageLeads(u.perfil)) throw new Error("Sem permissão");
  const supabase = await createClient();
  let q = supabase
    .from("agenda_compromissos")
    .select("*, leads(nome, whatsapp), usuarios(nome)")
    .gte("data_inicio", fromIso)
    .lte("data_inicio", toIso)
    .order("data_inicio");
  if (!isMaster(u.perfil) && u.perfil === "srd") {
    q = q.eq("consultor_id", u.id);
  } else if (consultorId) {
    q = q.eq("consultor_id", consultorId);
  }
  const { data, error } = await q;
  if (error) {
    if (/agenda_compromissos/.test(error.message) && /schema cache|does not exist/i.test(error.message)) {
      return [] as AgendaCompromissoRow[];
    }
    throw new Error(error.message);
  }
  return (data ?? []) as AgendaCompromissoRow[];
}

export async function fetchCompromissosLead(leadId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agenda_compromissos")
    .select("*, usuarios(nome)")
    .eq("lead_id", leadId)
    .order("data_inicio", { ascending: false })
    .limit(30);
  if (error) return [] as AgendaCompromissoRow[];
  return (data ?? []) as AgendaCompromissoRow[];
}

export async function createCompromissoAction(formData: FormData) {
  const u = await requireUsuario();
  if (!canManageLeads(u.perfil)) throw new Error("Sem permissão");
  const supabase = await createClient();
  const date = String(formData.get("data") ?? "").trim();
  const time = String(formData.get("hora") ?? "09:00").trim();
  const duracao = parseInt(String(formData.get("duracao_minutos") ?? "60"), 10) || 60;
  const dataInicio = parseDateTimeLocal(date, time);
  const dataFim = new Date(new Date(dataInicio).getTime() + duracao * 60_000).toISOString();
  const consultorId = String(formData.get("consultor_id") ?? u.id).trim() || u.id;

  const row = {
    lead_id: String(formData.get("lead_id") ?? "").trim() || null,
    consultor_id: consultorId,
    titulo: String(formData.get("titulo") ?? "").trim() || "Compromisso",
    descricao: String(formData.get("descricao") ?? "").trim() || null,
    tipo: String(formData.get("tipo") ?? "Atendimento"),
    data_inicio: dataInicio,
    data_fim: dataFim,
    duracao_minutos: duracao,
    local: String(formData.get("local") ?? "").trim() || null,
    status: "agendado" as AgendaStatus,
  };
  const { error } = await supabase.from("agenda_compromissos").insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/agenda");
  const leadId = row.lead_id;
  if (leadId) revalidatePath(`/admin/leads/${leadId}`);
}

export async function concluirCompromissoAction(compromissoId: string, formData: FormData) {
  const u = await requireUsuario();
  if (!canManageLeads(u.perfil)) throw new Error("Sem permissão");
  const supabase = await createClient();
  const resultado = String(formData.get("resultado") ?? "") as AgendaResultado;
  if (!AGENDA_RESULTADOS.includes(resultado)) throw new Error("Resultado inválido");
  const observacao = String(formData.get("observacao_resultado") ?? "").trim() || null;
  const proximaDataRaw = String(formData.get("proxima_data") ?? "").trim();
  const proximaHora = String(formData.get("proxima_hora") ?? "10:00").trim();
  let proxima_data: string | null = null;
  if (proximaDataRaw) proxima_data = parseDateTimeLocal(proximaDataRaw, proximaHora);

  const { data: comp, error: fetchErr } = await supabase
    .from("agenda_compromissos")
    .select("*, lead_id")
    .eq("id", compromissoId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  const { error } = await supabase
    .from("agenda_compromissos")
    .update({
      status: "concluido",
      resultado,
      observacao_resultado: observacao,
      proxima_data,
    })
    .eq("id", compromissoId);
  if (error) throw new Error(error.message);

  const leadId = comp.lead_id as string | null;
  if (leadId) {
    if (resultado === "Fechou") {
      await supabase.from("leads").update({ status: "Fechado", fechado: true, fechado_at: new Date().toISOString() }).eq("id", leadId);
    } else if (resultado === "Sem interesse") {
      await supabase.from("leads").update({ status: "Perdido", perdido_at: new Date().toISOString(), motivo_perda: "Sem interesse" }).eq("id", leadId);
    } else if (resultado === "Em negociação") {
      await supabase.from("leads").update({ status: "Negociação" }).eq("id", leadId);
    } else if (resultado === "Voltar a falar em data futura" && proxima_data) {
      await supabase
        .from("leads")
        .update({
          data_proxima_acao: proxima_data,
          proxima_acao: "Retorno agenda",
          proximo_retorno_data: proxima_data.slice(0, 10),
        })
        .eq("id", leadId);
      await supabase.from("agenda_compromissos").insert({
        lead_id: leadId,
        consultor_id: comp.consultor_id,
        titulo: "Retorno — follow-up",
        tipo: "Retorno",
        data_inicio: proxima_data,
        data_fim: new Date(new Date(proxima_data).getTime() + 30 * 60_000).toISOString(),
        duracao_minutos: 30,
        status: "agendado",
        descricao: observacao,
      });
    }
    revalidatePath(`/admin/leads/${leadId}`);
  }
  revalidatePath("/admin/agenda");
}

export async function cancelCompromissoAction(compromissoId: string) {
  const u = await requireUsuario();
  if (!canManageLeads(u.perfil)) throw new Error("Sem permissão");
  const supabase = await createClient();
  await supabase.from("agenda_compromissos").update({ status: "cancelado" }).eq("id", compromissoId);
  revalidatePath("/admin/agenda");
}
