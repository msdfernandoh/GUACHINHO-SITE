"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { canManageLeads, isMaster } from "@/lib/auth/permissions";
import type { AgendaCompromissoRow, AgendaStatus } from "@/lib/agenda/types";
import { AGENDA_RESULTADOS } from "@/lib/agenda/types";
import {
  parsePercentualParcela,
  parseValorMonetario,
  type AgendaFechamentoTipoParcela,
} from "@/lib/agenda/fechamento";
import { isGmailAddress, isGoogleCalendarConfigured } from "@/lib/google-calendar/config";
import { pushCompromissoToGoogleCalendar, removeCompromissoFromGoogleCalendar } from "@/lib/google-calendar/sync";

function parseDateTimeLocal(date: string, time: string): string {
  const normalized = time.length === 5 ? `${time}:00` : time;
  const d = new Date(`${date}T${normalized}`);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Data ou hora inválida.");
  }
  return d.toISOString();
}

async function attachAgendaRelations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: AgendaCompromissoRow[],
): Promise<AgendaCompromissoRow[]> {
  if (!rows.length) return rows;

  const leadIds = [...new Set(rows.map((r) => r.lead_id).filter(Boolean))] as string[];
  const consultorIds = [...new Set(rows.map((r) => r.consultor_id).filter(Boolean))] as string[];

  const leadsById = new Map<string, { nome: string; whatsapp: string | null }>();
  const consultoresById = new Map<string, { nome: string }>();

  if (leadIds.length) {
    const { data } = await supabase.from("leads").select("id, nome, whatsapp").in("id", leadIds);
    for (const row of data ?? []) {
      leadsById.set(row.id as string, {
        nome: row.nome as string,
        whatsapp: (row.whatsapp as string | null) ?? null,
      });
    }
  }

  if (consultorIds.length) {
    const { data } = await supabase.from("usuarios").select("id, nome").in("id", consultorIds);
    for (const row of data ?? []) {
      consultoresById.set(row.id as string, { nome: row.nome as string });
    }
  }

  return rows.map((r) => ({
    ...r,
    leads: r.lead_id ? leadsById.get(r.lead_id) ?? null : null,
    usuarios: r.consultor_id ? consultoresById.get(r.consultor_id) ?? { nome: "—" } : null,
  }));
}

export async function fetchCompromissosRange(fromIso: string, toIso: string, consultorId?: string) {
  const u = await requireUsuario();
  if (!canManageLeads(u.perfil)) throw new Error("Sem permissão");
  const supabase = await createClient();
  let q = supabase
    .from("agenda_compromissos")
    .select("*")
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
  return attachAgendaRelations(supabase, (data ?? []) as AgendaCompromissoRow[]);
}

export async function fetchCompromissosLead(leadId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agenda_compromissos")
    .select("*")
    .eq("lead_id", leadId)
    .order("data_inicio", { ascending: false })
    .limit(30);
  if (error) return [] as AgendaCompromissoRow[];
  return attachAgendaRelations(supabase, (data ?? []) as AgendaCompromissoRow[]);
}

export async function fetchLeadAgendaPreview(leadId: string) {
  const id = leadId.trim();
  if (!id) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").select("id, nome").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return { id: data.id as string, nome: data.nome as string };
}

export async function fetchGoogleCalendarStatusForCurrentUser() {
  const u = await requireUsuario();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("email, google_agenda_sync, google_calendar_connected_at")
    .eq("id", u.id)
    .maybeSingle();
  if (error && /google_agenda_sync|google_calendar_connected_at|schema cache/i.test(error.message)) {
    return {
      configured: isGoogleCalendarConfigured(),
      eligible: isGmailAddress(u.email),
      syncEnabled: false,
      connected: false,
    };
  }
  return {
    configured: isGoogleCalendarConfigured(),
    eligible: isGmailAddress(data?.email ?? u.email),
    syncEnabled: Boolean(data?.google_agenda_sync),
    connected: Boolean(data?.google_calendar_connected_at),
  };
}

export async function createCompromissoAction(formData: FormData) {
  const u = await requireUsuario();
  if (!canManageLeads(u.perfil)) throw new Error("Sem permissão");
  const supabase = await createClient();
  const date = String(formData.get("data") ?? "").trim();
  const time = String(formData.get("hora") ?? "09:00").trim();
  if (!date) throw new Error("Informe a data do compromisso.");
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
  const { data: inserted, error } = await supabase.from("agenda_compromissos").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  if (inserted?.id) {
    pushCompromissoToGoogleCalendar(inserted.id as string).catch((e) => {
      console.error("[agenda] google sync:", e);
    });
  }
  revalidatePath("/admin/agenda");
  const leadId = row.lead_id;
  if (leadId) revalidatePath(`/admin/leads/${leadId}`);

  const mes = String(formData.get("mes") ?? "").trim();
  const ano = String(formData.get("ano") ?? "").trim();
  const qs = new URLSearchParams();
  if (mes) qs.set("mes", mes);
  if (ano) qs.set("ano", ano);
  if (leadId) qs.set("lead", leadId);
  qs.set("dia", date);
  redirect(`/admin/agenda?${qs.toString()}`);
}

export async function reagendarCompromissoAction(compromissoId: string, formData: FormData) {
  const u = await requireUsuario();
  if (!canManageLeads(u.perfil)) throw new Error("Sem permissão");
  const supabase = await createClient();

  const date = String(formData.get("data") ?? "").trim();
  const time = String(formData.get("hora") ?? "10:00").trim();
  if (!date) throw new Error("Informe a nova data.");
  const duracao = parseInt(String(formData.get("duracao_minutos") ?? "60"), 10) || 60;
  const dataInicio = parseDateTimeLocal(date, time);
  const dataFim = new Date(new Date(dataInicio).getTime() + duracao * 60_000).toISOString();

  const { data: comp, error: fetchErr } = await supabase
    .from("agenda_compromissos")
    .select("id, status, lead_id")
    .eq("id", compromissoId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);
  if (comp.status !== "agendado") throw new Error("Só é possível reagendar compromissos agendados.");

  await removeCompromissoFromGoogleCalendar(compromissoId).catch((e) => {
    console.error("[agenda] google remove reagendar:", e);
  });

  const { error } = await supabase
    .from("agenda_compromissos")
    .update({
      data_inicio: dataInicio,
      data_fim: dataFim,
      duracao_minutos: duracao,
      status: "agendado",
      google_calendar_event_id: null,
    })
    .eq("id", compromissoId);
  if (error) throw new Error(error.message);

  pushCompromissoToGoogleCalendar(compromissoId).catch((e) => {
    console.error("[agenda] google sync reagendar:", e);
  });

  const leadId = comp.lead_id as string | null;
  if (leadId) {
    await supabase
      .from("leads")
      .update({
        data_proxima_acao: dataInicio,
        proximo_retorno_data: date,
      })
      .eq("id", leadId);
    revalidatePath(`/admin/leads/${leadId}`);
  }

  revalidatePath("/admin/agenda");
  const mes = String(formData.get("mes") ?? "").trim();
  const ano = String(formData.get("ano") ?? "").trim();
  const qs = new URLSearchParams();
  if (mes) qs.set("mes", mes);
  if (ano) qs.set("ano", ano);
  qs.set("dia", date);
  redirect(`/admin/agenda?${qs.toString()}`);
}

export async function retornarCompromissoAction(compromissoId: string, formData: FormData) {
  const u = await requireUsuario();
  if (!canManageLeads(u.perfil)) throw new Error("Sem permissão");
  const supabase = await createClient();

  const date = String(formData.get("data") ?? "").trim();
  const time = String(formData.get("hora") ?? "10:00").trim();
  if (!date) throw new Error("Informe a data do retorno.");
  const duracao = parseInt(String(formData.get("duracao_minutos") ?? "30"), 10) || 30;
  const dataInicio = parseDateTimeLocal(date, time);
  const dataFim = new Date(new Date(dataInicio).getTime() + duracao * 60_000).toISOString();
  const observacao = String(formData.get("descricao") ?? "").trim() || null;

  const { data: comp, error: fetchErr } = await supabase
    .from("agenda_compromissos")
    .select("lead_id, consultor_id, titulo")
    .eq("id", compromissoId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  const { data: inserted, error } = await supabase
    .from("agenda_compromissos")
    .insert({
      lead_id: comp.lead_id,
      consultor_id: comp.consultor_id,
      titulo: "Retorno — follow-up",
      tipo: "Retorno",
      data_inicio: dataInicio,
      data_fim: dataFim,
      duracao_minutos: duracao,
      status: "agendado",
      descricao: observacao ?? `Retorno após: ${comp.titulo}`,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (inserted?.id) {
    pushCompromissoToGoogleCalendar(inserted.id as string).catch((e) => {
      console.error("[agenda] google sync retorno:", e);
    });
  }

  const leadId = comp.lead_id as string | null;
  if (leadId) {
    await supabase
      .from("leads")
      .update({
        data_proxima_acao: dataInicio,
        proxima_acao: "Retorno agenda",
        proximo_retorno_data: date,
        proximo_retorno_hora: time.length === 5 ? `${time}:00` : time,
      })
      .eq("id", leadId);
    revalidatePath(`/admin/leads/${leadId}`);
  }

  revalidatePath("/admin/agenda");
  const mes = String(formData.get("mes") ?? "").trim();
  const ano = String(formData.get("ano") ?? "").trim();
  const qs = new URLSearchParams();
  if (mes) qs.set("mes", mes);
  if (ano) qs.set("ano", ano);
  qs.set("dia", date);
  redirect(`/admin/agenda?${qs.toString()}`);
}

export async function concluirCompromissoAction(compromissoId: string, formData: FormData) {
  const u = await requireUsuario();
  if (!canManageLeads(u.perfil)) throw new Error("Sem permissão");
  const supabase = await createClient();
  const outcome = String(formData.get("outcome") ?? "").trim();
  const observacao = String(formData.get("observacao_resultado") ?? "").trim() || null;

  let resultado: (typeof AGENDA_RESULTADOS)[number];
  if (outcome === "ganho") {
    resultado = "Fechou";
  } else if (outcome === "perda") {
    const motivo = String(formData.get("motivo_perda") ?? "").trim();
    if (motivo === "Em negociação") resultado = "Em negociação";
    else if (motivo === "Sem resposta") resultado = "Sem resposta";
    else if (motivo === "Sem interesse") resultado = "Sem interesse";
    else resultado = "Sem interesse";
  } else {
    throw new Error("Informe se o atendimento foi ganho ou perda.");
  }

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
      proxima_data: null,
    })
    .eq("id", compromissoId);
  if (error) throw new Error(error.message);

  const leadId = comp.lead_id as string | null;
  if (leadId) {
    const now = new Date().toISOString();
    if (outcome === "ganho") {
      const produto = String(formData.get("produto_fechado") ?? "").trim();
      const valorCredito = parseValorMonetario(String(formData.get("valor_credito") ?? ""));
      if (!produto) throw new Error("Selecione o tipo do bem.");
      if (valorCredito == null || valorCredito <= 0) throw new Error("Informe o valor do crédito vendido.");

      const tipoParcela = String(formData.get("tipo_parcela") ?? "integral").trim() as AgendaFechamentoTipoParcela;
      let percentual: number | null = null;
      if (tipoParcela === "reduzida") {
        percentual = parsePercentualParcela(String(formData.get("percentual_parcela") ?? ""));
        if (percentual == null) throw new Error("Informe o percentual da parcela reduzida (1–100).");
      }
      const valorParcela = parseValorMonetario(String(formData.get("valor_parcela") ?? ""));

      const leadPatch: Record<string, unknown> = {
        status: "Fechado",
        fechado: true,
        fechado_at: now,
        data_fechamento: now.slice(0, 10),
        valor_fechado: valorCredito,
        produto_fechado: produto,
        observacao_fechamento: observacao,
        motivo_perda: null,
        observacao_perda: null,
        perdido_at: null,
        fechamento_tipo_parcela: tipoParcela,
        fechamento_percentual_parcela: tipoParcela === "reduzida" ? percentual : null,
        valor_parcela_fechamento: valorParcela,
      };

      let { error: leadErr } = await supabase.from("leads").update(leadPatch).eq("id", leadId);
      if (leadErr && /fechamento_|valor_parcela_fechamento|schema cache/i.test(leadErr.message)) {
        const { fechamento_tipo_parcela: _a, fechamento_percentual_parcela: _b, valor_parcela_fechamento: _c, ...fallback } =
          leadPatch;
        ({ error: leadErr } = await supabase.from("leads").update(fallback).eq("id", leadId));
      }
      if (leadErr) throw new Error(leadErr.message);
    } else {
      const motivo = String(formData.get("motivo_perda") ?? "").trim() || "Sem interesse";
      if (motivo === "Em negociação") {
        await supabase.from("leads").update({ status: "Negociação" }).eq("id", leadId);
      } else if (motivo === "Sem resposta") {
        await supabase
          .from("leads")
          .update({
            status: "Perdido",
            perdido_at: now,
            motivo_perda: motivo,
            observacao_perda: observacao,
          })
          .eq("id", leadId);
      } else {
        await supabase
          .from("leads")
          .update({
            status: "Perdido",
            perdido_at: now,
            motivo_perda: motivo,
            observacao_perda: observacao,
          })
          .eq("id", leadId);
      }
    }
    revalidatePath(`/admin/leads/${leadId}`);
  }
  revalidatePath("/admin/agenda");
}

export async function cancelCompromissoAction(compromissoId: string) {
  const u = await requireUsuario();
  if (!canManageLeads(u.perfil)) throw new Error("Sem permissão");
  const supabase = await createClient();
  await removeCompromissoFromGoogleCalendar(compromissoId).catch((e) => {
    console.error("[agenda] google remove:", e);
  });
  await supabase.from("agenda_compromissos").update({ status: "cancelado" }).eq("id", compromissoId);
  revalidatePath("/admin/agenda");
}
