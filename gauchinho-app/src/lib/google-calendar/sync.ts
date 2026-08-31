import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireTenantPermission } from "@/lib/tenant/context";
import { isGmailAddress, isGoogleCalendarConfigured } from "./config";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  refreshGoogleAccessToken,
  updateGoogleCalendarEvent,
  fetchGoogleAccountEmail,
  type GoogleCalendarEventInput,
} from "./client";
import { logGoogleCalendar, logGoogleCalendarError } from "./log";
import { clearGoogleRefreshToken, getGoogleRefreshToken } from "./token-store";
import { GoogleCalendarAuthError, type GoogleCalendarSyncResult } from "./types";
import { formatGoogleSyncUserMessage } from "./sync-messages";

type CompromissoRow = {
  id: string;
  empresa_id: string;
  consultor_id: string | null;
  lead_id: string | null;
  titulo: string;
  descricao: string | null;
  tipo: string;
  data_inicio: string;
  data_fim: string | null;
  duracao_minutos: number | null;
  local: string | null;
  status: string;
  google_calendar_event_id: string | null;
  dia_inteiro: boolean;
  origem: string;
};

type ParticipanteRow = { usuario_id: string; google_calendar_event_id: string | null; google_conta_email?: string | null };

type ConsultorGoogle = {
  id: string;
  nome: string;
  email: string;
  google_agenda_sync: boolean;
};

async function loadConsultorGoogle(consultorId: string, empresaId: string): Promise<ConsultorGoogle | null> {
  const admin = createAdminClient();
  const { data: link, error: linkError } = await admin.from("empresa_usuarios").select("google_agenda_sync")
    .eq("empresa_id", empresaId).eq("usuario_id", consultorId).eq("ativo", true).maybeSingle();
  if (linkError) throw new Error("Falha ao validar integração da empresa.");
  if (!link) return null;
  const { data, error } = await admin
    .from("usuarios")
    .select("id, nome, email, google_agenda_sync")
    .eq("id", consultorId)
    .maybeSingle();
  if (error) throw new Error("Falha ao carregar responsável.");
  return data ? { ...data, google_agenda_sync: Boolean(link.google_agenda_sync) } as ConsultorGoogle : null;
}

function buildEventInput(row: CompromissoRow, descricao: string): GoogleCalendarEventInput {
  const dataFim =
    row.data_fim ??
    new Date(new Date(row.data_inicio).getTime() + (row.duracao_minutos ?? 60) * 60_000).toISOString();
  return {
    titulo: row.titulo,
    descricao,
    local: row.local,
    dataInicioIso: row.data_inicio,
    dataFimIso: dataFim,
    diaInteiro: row.dia_inteiro,
    compromissoId: row.id,
  };
}

async function buildEventDescription(comp: CompromissoRow): Promise<string> {
  const parts = [`Tipo: ${comp.tipo}`, "Origem: Gauchinho — Agenda comercial"];
  if (comp.descricao?.trim()) parts.push(comp.descricao.trim());
  if (comp.lead_id) {
    const admin = createAdminClient();
    const { data: lead } = await admin.from("leads").select("nome, whatsapp").eq("empresa_id", comp.empresa_id).eq("id", comp.lead_id).maybeSingle();
    if (lead) {
      parts.push(`Lead: ${lead.nome as string}`);
      if (lead.whatsapp) parts.push(`WhatsApp: ${lead.whatsapp as string}`);
    }
  }
  return parts.join("\n");
}

function resultBase(
  consultor: ConsultorGoogle | null,
  partial: Omit<GoogleCalendarSyncResult, "consultorId" | "consultorNome" | "userMessage">,
): GoogleCalendarSyncResult {
  const base = {
    ...partial,
    consultorId: consultor?.id,
    consultorNome: consultor?.nome,
  };
  return {
    ...base,
    userMessage: formatGoogleSyncUserMessage(base.reason, consultor?.nome ?? "Consultor", base.synced),
  };
}

export async function getAccessTokenForConsultor(
  consultorId: string,
): Promise<{ accessToken: string } | { error: Omit<GoogleCalendarSyncResult, "consultorId" | "consultorNome" | "userMessage"> }> {
  const refresh = await getGoogleRefreshToken(consultorId);
  if (!refresh) {
    return { error: { synced: false, reason: "consultor_not_connected", requiresReconnect: false } };
  }
  try {
    return { accessToken: await refreshGoogleAccessToken(refresh) };
  } catch (e) {
    if (e instanceof GoogleCalendarAuthError && e.code === "invalid_grant") {
      await clearGoogleRefreshToken(consultorId);
      logGoogleCalendarError({ op: "refresh_invalid_grant", consultorId, errorCode: "invalid_grant" });
      return { error: { synced: false, reason: "requires_reconnect", requiresReconnect: true } };
    }
    if (e instanceof GoogleCalendarAuthError && e.code === "transient") {
      return { error: { synced: false, reason: "google_temporary_error" } };
    }
    logGoogleCalendarError({ op: "refresh_failed", consultorId, errorCode: "unknown" });
    return { error: { synced: false, reason: "google_error" } };
  }
}

async function loadCompromisso(compromissoId: string): Promise<CompromissoRow | null> {
  const { empresaAtiva } = await requireTenantPermission("acessar_agenda");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agenda_compromissos")
    .select(
      "id, empresa_id, consultor_id, lead_id, titulo, descricao, tipo, data_inicio, data_fim, duracao_minutos, local, status, google_calendar_event_id, dia_inteiro, origem",
    )
    .eq("empresa_id", empresaAtiva.id)
    .eq("id", compromissoId)
    .maybeSingle();
  if (error || !data) return null;
  const { data: authorized, error: authError } = await supabase.rpc("agenda_pode_operar_compromisso", {
    p_empresa_id: empresaAtiva.id, p_consultor_id: data.consultor_id,
  });
  if (authError || !authorized || data.origem === "GOOGLE") return null;
  return data as CompromissoRow;
}

async function loadParticipantes(row: CompromissoRow): Promise<ParticipanteRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agenda_compromisso_participantes")
    .select("usuario_id,google_calendar_event_id,google_conta_email")
    .eq("empresa_id", row.empresa_id)
    .eq("compromisso_id", row.id);
  if (error) throw new Error("Falha ao consultar participantes.");
  if (data?.length) return data as ParticipanteRow[];
  return row.consultor_id ? [{ usuario_id: row.consultor_id, google_calendar_event_id: row.google_calendar_event_id }] : [];
}

export async function pushCompromissoToGoogleCalendar(compromissoId: string): Promise<GoogleCalendarSyncResult> {
  logGoogleCalendar({ op: "push_start", compromissoId });

  if (!isGoogleCalendarConfigured()) {
    return {
      synced: false,
      reason: "oauth_not_configured",
      userMessage: formatGoogleSyncUserMessage("oauth_not_configured", "Consultor", false),
    };
  }

  const row = await loadCompromisso(compromissoId);
  if (!row) return { synced: false, reason: "google_error" };
  if (row.status !== "agendado") return { synced: false, reason: "not_agendado" };
  const participantes = await loadParticipantes(row);
  if (!participantes.length) return { synced: false, reason: "no_consultor" };
  const descricao = await buildEventDescription(row);
  const input = buildEventInput(row, descricao);
  const admin = createAdminClient();
  let synced = 0;
  let lastEventId: string | undefined;
  let firstResult: GoogleCalendarSyncResult | null = null;
  for (const participante of participantes) {
    const consultor = await loadConsultorGoogle(participante.usuario_id, row.empresa_id);
    if (!consultor?.google_agenda_sync || !isGmailAddress(consultor.email)) {
      firstResult ??= resultBase(consultor, { synced: false, reason: "integration_disabled" });
      continue;
    }
    const tokenResult = await getAccessTokenForConsultor(consultor.id);
    if ("error" in tokenResult) { firstResult ??= resultBase(consultor, tokenResult.error); continue; }
    try {
      const accountEmail = await fetchGoogleAccountEmail(tokenResult.accessToken);
      if (!accountEmail || (participante.google_calendar_event_id && participante.google_conta_email !== accountEmail)) {
        firstResult ??= resultBase(consultor, { synced: false, reason: "google_error" });
        continue;
      }
      let eventId = participante.google_calendar_event_id;
      if (eventId) await updateGoogleCalendarEvent(tokenResult.accessToken, eventId, input);
      else eventId = await createGoogleCalendarEvent(tokenResult.accessToken, {
        ...input, eventId: createHash("sha256").update(`${row.empresa_id}:${row.id}:${consultor.id}`).digest("hex"),
      });
      const { error: saveError } = await admin.from("agenda_compromisso_participantes").update({ google_calendar_event_id: eventId, google_conta_email: accountEmail, google_updated_at: new Date().toISOString() })
        .eq("empresa_id", row.empresa_id).eq("compromisso_id", row.id).eq("usuario_id", consultor.id);
      if (saveError) throw new Error("Falha ao registrar sincronização.");
      if (consultor.id === row.consultor_id) {
        const { error: ownerError } = await admin.from("agenda_compromissos").update({ google_calendar_event_id: eventId }).eq("empresa_id", row.empresa_id).eq("id", row.id);
        if (ownerError) throw new Error("Falha ao registrar sincronização do responsável.");
      }
      synced += 1;
      lastEventId = eventId;
    } catch {
      firstResult ??= resultBase(consultor, { synced: false, reason: "google_error" });
      logGoogleCalendarError({ op: "push_failed", compromissoId, consultorId: consultor.id, errorCode: "create_or_update" });
    }
  }
  return firstResult ?? { synced: synced > 0, reason: synced ? "synced" : "integration_disabled", eventId: lastEventId };
}

export async function updateCompromissoOnGoogleCalendar(compromissoId: string): Promise<GoogleCalendarSyncResult> {
  logGoogleCalendar({ op: "update_start", compromissoId });

  if (!isGoogleCalendarConfigured()) {
    return { synced: false, reason: "oauth_not_configured" };
  }

  const row = await loadCompromisso(compromissoId);
  if (!row || row.status !== "agendado" || !row.consultor_id) {
    return { synced: false, reason: "not_agendado" };
  }

  return pushCompromissoToGoogleCalendar(compromissoId);
}

export async function removeCompromissoFromGoogleCalendar(compromissoId: string): Promise<GoogleCalendarSyncResult> {
  logGoogleCalendar({ op: "remove_start", compromissoId });

  if (!isGoogleCalendarConfigured()) {
    return { synced: false, reason: "oauth_not_configured" };
  }

  const admin = createAdminClient();
  const comp = await loadCompromisso(compromissoId);
  if (!comp) return { synced: false, reason: "google_error" };
  if (comp.status !== "cancelado") return { synced: false, reason: "not_agendado" };
  const participantes = await loadParticipantes(comp);
  let failed = false;
  for (const participante of participantes) {
    if (!participante.google_calendar_event_id) continue;
    const consultor = await loadConsultorGoogle(participante.usuario_id, comp.empresa_id);
    if (!consultor?.google_agenda_sync) { failed = true; continue; }
    const tokenResult = await getAccessTokenForConsultor(participante.usuario_id);
    if ("error" in tokenResult) { failed = true; continue; }
    try {
      const email = await fetchGoogleAccountEmail(tokenResult.accessToken);
      if (!email || email !== participante.google_conta_email) { failed = true; continue; }
      await deleteGoogleCalendarEvent(tokenResult.accessToken, participante.google_calendar_event_id);
      const { error } = await admin.from("agenda_compromisso_participantes").update({ google_calendar_event_id: null })
        .eq("empresa_id", comp.empresa_id).eq("compromisso_id", compromissoId).eq("usuario_id", participante.usuario_id);
      if (error) failed = true;
    } catch { failed = true; }
  }
  if (failed) return { synced: false, reason: "google_error" };
  const { error } = await admin.from("agenda_compromissos").update({ google_calendar_event_id: null }).eq("empresa_id", comp.empresa_id).eq("id", compromissoId);
  if (error) return { synced: false, reason: "google_error" };
  return { synced: true, reason: "synced" };
}

export async function reassignCompromissoGoogleCalendar(
  compromissoId: string,
  previousConsultorId: string | null,
  newConsultorId: string | null,
): Promise<void> {
  if (previousConsultorId && previousConsultorId !== newConsultorId) {
    const comp = await loadCompromisso(compromissoId);
    if (comp?.google_calendar_event_id) {
      await removeCompromissoFromGoogleCalendar(compromissoId);
    } else {
      const admin = createAdminClient();
      await admin.from("agenda_compromissos").update({ google_calendar_event_id: null }).eq("id", compromissoId);
    }
  }
  if (newConsultorId) {
    await pushCompromissoToGoogleCalendar(compromissoId);
  }
}
