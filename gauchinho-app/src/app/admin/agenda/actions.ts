"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { requireTenantPermission } from "@/lib/tenant/context";
import { resolverConsultorPorId } from "@/lib/admin/consultores";
import { agendaFormRange } from "@/lib/agenda/timezone";
import { pullGoogleCalendarToAgenda } from "@/lib/google-calendar/pull-sync";
import type { AgendaCompromissoRow, AgendaStatus } from "@/lib/agenda/types";
import { AGENDA_RESULTADOS } from "@/lib/agenda/types";
import {
  parsePercentualParcela,
  parseValorMonetario,
  type AgendaFechamentoTipoParcela,
} from "@/lib/agenda/fechamento";
import { isGmailAddress, getGoogleCalendarSetupInfo } from "@/lib/google-calendar/config";
import {
  pushCompromissoToGoogleCalendar,
  removeCompromissoFromGoogleCalendar,
  updateCompromissoOnGoogleCalendar,
} from "@/lib/google-calendar/sync";
import { appendSyncResultToSearchParams } from "@/lib/google-calendar/sync-messages";
import type { GoogleCalendarSyncResult } from "@/lib/google-calendar/types";
import { getGoogleRefreshToken } from "@/lib/google-calendar/token-store";

export async function podeOperarEquipeAgenda() {
  const { empresaAtiva } = await requireTenantPermission("acessar_agenda");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("agenda_pode_ver_todos", { p_empresa_id: empresaAtiva.id });
  if (error) throw new Error(error.message);
  return data === true;
}

async function assertSemConflito(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  consultorId: string,
  inicio: string,
  fim: string,
  ignorarId?: string,
) {
  let query = supabase
    .from("agenda_compromissos")
    .select("id,titulo")
    .eq("empresa_id", empresaId)
    .eq("consultor_id", consultorId)
    .eq("status", "agendado")
    .lt("data_inicio", fim)
    .gt("data_fim", inicio)
    .limit(1);
  if (ignorarId) query = query.neq("id", ignorarId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  if (data?.length) throw new Error(`Conflito de horário com “${data[0].titulo}”. Escolha outro horário.`);
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
  const participantesByCompromisso = new Map<string, Array<{ usuario_id: string; nome: string }>>();

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
  const { data: participantes } = await supabase.from("agenda_compromisso_participantes")
    .select("compromisso_id,usuario_id,usuario:usuarios(nome)")
    .in("compromisso_id", rows.map((r) => r.id));
  for (const p of participantes ?? []) {
    const usuario = Array.isArray(p.usuario) ? p.usuario[0] : p.usuario;
    const list = participantesByCompromisso.get(p.compromisso_id as string) ?? [];
    list.push({ usuario_id: p.usuario_id as string, nome: String(usuario?.nome ?? "Usuário") });
    participantesByCompromisso.set(p.compromisso_id as string, list);
  }

  return rows.map((r) => ({
    ...r,
    leads: r.lead_id ? leadsById.get(r.lead_id) ?? null : null,
    usuarios: r.consultor_id ? consultoresById.get(r.consultor_id) ?? { nome: "—" } : null,
    participantes: participantesByCompromisso.get(r.id) ?? [],
  }));
}

export async function fetchCompromissosRange(fromIso: string, toIso: string, consultorId?: string) {
  const { usuario: u, empresaAtiva } = await requireTenantPermission("acessar_agenda");
  const supabase = await createClient();
  let q = supabase
    .from("agenda_compromissos")
    .select("*")
    .eq("empresa_id", empresaAtiva.id)
    .lt("data_inicio", toIso)
    .or(`data_fim.gt.${new Date(fromIso).toISOString()},and(data_fim.is.null,data_inicio.gte.${new Date(fromIso).toISOString()})`)
    .order("data_inicio");
  const podeEquipe = await podeOperarEquipeAgenda();
  if (consultorId && !/^[0-9a-f-]{36}$/i.test(consultorId)) throw new Error("Responsável inválido.");
  const filtroUsuarioId = !podeEquipe ? u.id : consultorId;
  let participanteIds: string[] = [];
  if (filtroUsuarioId) {
    const { data: participacoes } = await supabase.from("agenda_compromisso_participantes")
      .select("compromisso_id").eq("empresa_id", empresaAtiva.id).eq("usuario_id", filtroUsuarioId);
    participanteIds = (participacoes ?? []).map((p) => p.compromisso_id as string);
  }
  if (!podeEquipe) {
    q = participanteIds.length ? q.or(`consultor_id.eq.${u.id},id.in.(${participanteIds.join(",")})`) : q.eq("consultor_id", u.id);
  } else if (consultorId) {
    q = participanteIds.length ? q.or(`consultor_id.eq.${consultorId},id.in.(${participanteIds.join(",")})`) : q.eq("consultor_id", consultorId);
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
  const { empresaAtiva } = await requireTenantPermission("acessar_agenda");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agenda_compromissos")
    .select("*")
    .eq("empresa_id", empresaAtiva.id)
    .eq("lead_id", leadId)
    .order("data_inicio", { ascending: false })
    .limit(30);
  if (error) return [] as AgendaCompromissoRow[];
  return attachAgendaRelations(supabase, (data ?? []) as AgendaCompromissoRow[]);
}

export async function fetchLeadAgendaPreview(leadId: string) {
  const id = leadId.trim();
  if (!id) return null;
  const { empresaAtiva } = await requireTenantPermission("acessar_agenda");
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").select("id, nome").eq("empresa_id", empresaAtiva.id).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return { id: data.id as string, nome: data.nome as string };
}

export async function fetchGoogleCalendarStatusForCurrentUser() {
  const { usuario: u, empresaAtiva } = await requireTenantPermission("acessar_agenda");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("email, google_agenda_sync, google_calendar_connected_at, google_calendar_email")
    .eq("id", u.id)
    .maybeSingle();
  const setup = getGoogleCalendarSetupInfo();
  const { data: link } = await supabase.from("empresa_usuarios").select("google_agenda_bidirecional,google_agenda_sync")
    .eq("empresa_id", empresaAtiva.id).eq("usuario_id", u.id).maybeSingle();
  const { data: state } = await supabase.from("agenda_google_sync_estado").select("ultima_sincronizacao,ultimo_erro")
    .eq("empresa_id", empresaAtiva.id).eq("usuario_id", u.id).maybeSingle();
  const base = {
    configured: setup.configured,
    eligible: isGmailAddress(data?.email ?? u.email),
    syncEnabled: Boolean(link?.google_agenda_sync),
    connected: Boolean(data?.google_calendar_connected_at),
    googleEmail: (data?.google_calendar_email as string | null) ?? null,
    connectedAt: (data?.google_calendar_connected_at as string | null) ?? null,
    oauthRedirectUri: setup.oauthRedirectUri,
    hasClientId: setup.hasClientId,
    hasClientSecret: setup.hasClientSecret,
    requiresReconnect: false,
    bidirectional: Boolean(link?.google_agenda_bidirecional),
    lastSync: state?.ultima_sincronizacao ?? null,
    lastError: state?.ultimo_erro ?? null,
  };
  if (error && /google_agenda_sync|google_calendar_connected_at|google_calendar_email|schema cache/i.test(error.message)) {
    return { ...base, eligible: isGmailAddress(u.email), syncEnabled: false, connected: false };
  }
  if (base.syncEnabled && base.connected) {
    const token = await getGoogleRefreshToken(u.id);
    base.requiresReconnect = !token;
  }
  return base;
}

export async function createCompromissoAction(formData: FormData) {
  const { usuario: u, empresaAtiva } = await requireTenantPermission("acessar_agenda");
  const supabase = await createClient();
  const date = String(formData.get("data") ?? "").trim();
  if (!date) throw new Error("Informe a data do compromisso.");
  const { inicio: dataInicio, fim: dataFim, duracao, diaInteiro } = agendaFormRange(formData);
  const escopoEquipe = formData.get("escopo") === "EQUIPE";
  const consultorId = escopoEquipe ? u.id : String(formData.get("consultor_id") ?? u.id).trim() || u.id;
  const podeOperarEquipe = await podeOperarEquipeAgenda();
  if ((escopoEquipe || consultorId !== u.id) && !podeOperarEquipe) throw new Error("Sem permissão para agendar para a equipe.");
  const consultor = await resolverConsultorPorId(supabase, consultorId, empresaAtiva.id);
  if (!consultor) throw new Error("Responsável inválido para esta empresa.");

  const requestId = String(formData.get("request_id") ?? "");
  const row = {
    id: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId) ? requestId : randomUUID(),
    empresa_id: empresaAtiva.id,
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
    escopo: escopoEquipe ? "EQUIPE" : "INDIVIDUAL",
    dia_inteiro: diaInteiro,
    modalidade_atendimento: (() => {
      const m = String(formData.get("modalidade_atendimento") ?? "").trim();
      return m === "presencial" || m === "online" ? m : null;
    })(),
  };
  // Participantes são gravados pelo trigger na mesma transação do compromisso.
  let { data: inserted, error } = await supabase.from("agenda_compromissos").insert(row).select("id").single();
  if (error?.code === "23505") {
    const previous = await supabase.from("agenda_compromissos").select("*").eq("empresa_id", empresaAtiva.id)
      .eq("id", row.id).eq("criado_por_usuario_id", u.id).single();
    const matches = previous.data && Object.entries(row).every(([key, value]) => {
      const saved = previous.data[key];
      return key === "data_inicio" || key === "data_fim" ? Date.parse(saved) === Date.parse(String(value)) : saved === value;
    });
    if (matches) { inserted = { id: row.id }; error = null; }
  }
  if (error) throw new Error(error.message);

  const mes = String(formData.get("mes") ?? "").trim();
  const ano = String(formData.get("ano") ?? "").trim();
  const qs = new URLSearchParams();
  if (mes) qs.set("mes", mes);
  if (ano) qs.set("ano", ano);
  if (row.lead_id) qs.set("lead", row.lead_id);
  qs.set("dia", date);

  if (inserted?.id) {
    const syncResult = await pushCompromissoToGoogleCalendar(inserted.id as string).catch((): GoogleCalendarSyncResult => ({ synced: false, reason: "google_error" }));
    appendSyncResultToSearchParams(qs, syncResult);
  }

  revalidatePath("/admin/agenda");
  const leadId = row.lead_id;
  if (leadId) revalidatePath(`/admin/leads/${leadId}`);

  redirect(`/admin/agenda?${qs.toString()}`);
}

export async function reagendarCompromissoAction(compromissoId: string, formData: FormData) {
  const { empresaAtiva } = await requireTenantPermission("acessar_agenda");
  const supabase = await createClient();

  const date = String(formData.get("data") ?? "").trim();
  if (!date) throw new Error("Informe a nova data.");
  const { inicio: dataInicio, fim: dataFim, duracao, diaInteiro } = agendaFormRange(formData);

  const { data: comp, error: fetchErr } = await supabase
    .from("agenda_compromissos")
    .select("id, status, lead_id, consultor_id")
    .eq("empresa_id", empresaAtiva.id)
    .eq("id", compromissoId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);
  if (comp.status !== "agendado") throw new Error("Só é possível reagendar compromissos agendados.");
  await assertSemConflito(supabase, empresaAtiva.id, comp.consultor_id as string, dataInicio, dataFim, compromissoId);

  const { error } = await supabase
    .from("agenda_compromissos")
    .update({
      data_inicio: dataInicio,
      data_fim: dataFim,
      duracao_minutos: duracao,
      dia_inteiro: diaInteiro,
      status: "agendado",
    })
    .eq("empresa_id", empresaAtiva.id)
    .eq("id", compromissoId).eq("status", "agendado").select("id").single();
  if (error) throw new Error(error.message);

  const syncResult = await updateCompromissoOnGoogleCalendar(compromissoId).catch((): GoogleCalendarSyncResult => ({ synced: false, reason: "google_error" }));

  const leadId = comp.lead_id as string | null;
  if (leadId) {
    await supabase
      .from("leads")
      .update({
        data_proxima_acao: dataInicio,
        proximo_retorno_data: date,
      })
      .eq("empresa_id", empresaAtiva.id)
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
  appendSyncResultToSearchParams(qs, syncResult);
  redirect(`/admin/agenda?${qs.toString()}`);
}

export async function retornarCompromissoAction(compromissoId: string, formData: FormData) {
  const { empresaAtiva } = await requireTenantPermission("acessar_agenda");
  const supabase = await createClient();

  const date = String(formData.get("data") ?? "").trim();
  const time = String(formData.get("hora") ?? "10:00").trim();
  if (!date) throw new Error("Informe a data do retorno.");
  const { inicio: dataInicio, fim: dataFim, duracao, diaInteiro } = agendaFormRange(formData, 30);
  const observacao = String(formData.get("descricao") ?? "").trim() || null;

  const { data: comp, error: fetchErr } = await supabase
    .from("agenda_compromissos")
    .select("lead_id, consultor_id, titulo")
    .eq("empresa_id", empresaAtiva.id)
    .eq("id", compromissoId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  const { data: inserted, error } = await supabase
    .from("agenda_compromissos")
    .insert({
      empresa_id: empresaAtiva.id,
      lead_id: comp.lead_id,
      consultor_id: comp.consultor_id,
      titulo: "Retorno — follow-up",
      tipo: "Retorno",
      data_inicio: dataInicio,
      data_fim: dataFim,
      duracao_minutos: duracao,
      dia_inteiro: diaInteiro,
      status: "agendado",
      descricao: observacao ?? `Retorno após: ${comp.titulo}`,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  let syncResult: GoogleCalendarSyncResult = { synced: false, reason: "google_error" };
  if (inserted?.id) {
    syncResult = await pushCompromissoToGoogleCalendar(inserted.id as string).catch((): GoogleCalendarSyncResult => ({ synced: false, reason: "google_error" }));
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
      .eq("empresa_id", empresaAtiva.id)
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
  appendSyncResultToSearchParams(qs, syncResult);
  redirect(`/admin/agenda?${qs.toString()}`);
}

export async function concluirCompromissoAction(compromissoId: string, formData: FormData) {
  const { empresaAtiva } = await requireTenantPermission("acessar_agenda");
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

  const produto = outcome === "ganho" ? String(formData.get("produto_fechado") ?? "").trim() : null;
  let valorCredito: number | null = null;
  let tipoParcela: AgendaFechamentoTipoParcela | null = null;
  let percentual: number | null = null;
  let valorParcela: number | null = null;
  if (outcome === "ganho") {
      valorCredito = parseValorMonetario(String(formData.get("valor_credito") ?? ""));
      if (!produto) throw new Error("Selecione o tipo do bem.");
      if (valorCredito == null || valorCredito <= 0) throw new Error("Informe o valor do crédito vendido.");
      tipoParcela = String(formData.get("tipo_parcela") ?? "integral").trim() as AgendaFechamentoTipoParcela;
      if (tipoParcela === "reduzida") {
        percentual = parsePercentualParcela(String(formData.get("percentual_parcela") ?? ""));
        if (percentual == null) throw new Error("Informe o percentual da parcela reduzida (1–100).");
      }
      valorParcela = parseValorMonetario(String(formData.get("valor_parcela") ?? ""));
  }
  const motivo = outcome === "perda" ? String(formData.get("motivo_perda") ?? "").trim() || "Sem interesse" : null;
  const { data, error } = await supabase.rpc("rpc_concluir_compromisso_agenda", {
    p_empresa_id: empresaAtiva.id,
    p_compromisso_id: compromissoId,
    p_outcome: outcome,
    p_resultado: resultado,
    p_observacao: observacao,
    p_motivo_perda: motivo,
    p_produto_fechado: produto,
    p_valor_credito: valorCredito,
    p_tipo_parcela: tipoParcela,
    p_percentual_parcela: percentual,
    p_valor_parcela: valorParcela,
  });
  if (error) throw new Error(error.message);
  const leadId = (data as { lead_id?: string | null } | null)?.lead_id ?? null;
  if (leadId) revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/agenda");
}

export async function fetchAgendaLeadOptions() {
  const { empresaAtiva } = await requireTenantPermission("acessar_agenda");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id,nome,whatsapp")
    .eq("empresa_id", empresaAtiva.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map((lead) => ({ id: lead.id as string, nome: lead.nome as string, whatsapp: lead.whatsapp as string | null }));
}

export async function cancelCompromissoAction(compromissoId: string) {
  const { empresaAtiva } = await requireTenantPermission("acessar_agenda");
  const supabase = await createClient();
  const { error } = await supabase.from("agenda_compromissos").update({ status: "cancelado" }).eq("empresa_id", empresaAtiva.id)
    .eq("id", compromissoId).in("status", ["agendado", "cancelado"]).select("id").single();
  if (error) throw new Error(error.message);
  const result = await removeCompromissoFromGoogleCalendar(compromissoId);
  revalidatePath("/admin/agenda");
  if (!result.synced && result.reason === "google_error") throw new Error("Cancelado no sistema. Falha ao cancelar no Google; tente sincronizar novamente.");
}

export async function marcarNaoCompareceuAction(compromissoId: string) {
  const { empresaAtiva } = await requireTenantPermission("acessar_agenda");
  const supabase = await createClient();
  const { error } = await supabase
    .from("agenda_compromissos")
    .update({ status: "nao_compareceu", resultado: "Não compareceu" })
    .eq("empresa_id", empresaAtiva.id)
    .eq("id", compromissoId)
    .eq("status", "agendado");
  if (error) throw new Error(error.message);
  revalidatePath("/admin/agenda");
}

export async function toggleGoogleBidirecionalAction(formData: FormData) {
  const { usuario, empresaAtiva } = await requireTenantPermission("acessar_agenda");
  const enabled = formData.get("enabled") === "true";
  if (enabled && formData.get("consentimento") !== "on") throw new Error("Confirme o compartilhamento com a empresa.");
  if (enabled && !(await getGoogleRefreshToken(usuario.id))) throw new Error("Conecte sua Google Agenda primeiro.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_agenda_google_consentimento", { p_empresa_id: empresaAtiva.id, p_habilitar: enabled });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/agenda");
}

export async function sincronizarGoogleAgoraAction() {
  try {
    const { usuario, empresaAtiva } = await requireTenantPermission("acessar_agenda");
    const result = await pullGoogleCalendarToAgenda(empresaAtiva.id, usuario.id);
    revalidatePath("/admin/agenda");
    return { error: false, message: `Importação concluída: ${result.imported} novos, ${result.updated} atualizados e ${result.cancelled} cancelados.` };
  } catch (error) {
    return { error: true, message: error instanceof Error ? error.message : "Falha ao importar Google Agenda." };
  }
}

export async function configurarImportacaoGoogleAction(_state: { error: boolean; message: string }, formData: FormData) {
  try {
    await toggleGoogleBidirecionalAction(formData);
    return { error: false, message: formData.get("enabled") === "true" ? "Importação autorizada. Clique em Importar agora." : "Importação desativada. O histórico foi preservado." };
  } catch (error) {
    return { error: true, message: error instanceof Error ? error.message : "Falha ao alterar importação." };
  }
}

export async function marcarRealizadoAgendaAction(compromissoId: string) {
  const { empresaAtiva } = await requireTenantPermission("acessar_agenda");
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_agenda_marcar_realizado", { p_empresa_id: empresaAtiva.id, p_compromisso_id: compromissoId });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/agenda");
}

export async function reenviarCompromissoGoogleAction(compromissoId: string) {
  const { empresaAtiva } = await requireTenantPermission("acessar_agenda");
  const supabase = await createClient();
  const { data, error } = await supabase.from("agenda_compromissos").select("status").eq("empresa_id", empresaAtiva.id).eq("id", compromissoId).single();
  if (error) throw new Error("Compromisso indisponível.");
  const result = await (data.status === "cancelado" ? removeCompromissoFromGoogleCalendar(compromissoId) : pushCompromissoToGoogleCalendar(compromissoId))
    .catch((): GoogleCalendarSyncResult => ({ synced: false, reason: "google_error" }));
  const qs = new URLSearchParams(); appendSyncResultToSearchParams(qs, result);
  revalidatePath("/admin/agenda"); redirect(`/admin/agenda?${qs}`);
}
