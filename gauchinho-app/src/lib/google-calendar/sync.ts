import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGmailAddress, isGoogleCalendarConfigured } from "./config";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  refreshGoogleAccessToken,
  updateGoogleCalendarEvent,
  type GoogleCalendarEventInput,
} from "./client";
import { logGoogleCalendar, logGoogleCalendarError } from "./log";
import { clearGoogleRefreshToken, getGoogleRefreshToken } from "./token-store";
import { GoogleCalendarAuthError, type GoogleCalendarSyncResult } from "./types";
import { formatGoogleSyncUserMessage } from "./sync-messages";

type CompromissoRow = {
  id: string;
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
};

type ConsultorGoogle = {
  id: string;
  nome: string;
  email: string;
  google_agenda_sync: boolean;
};

async function loadConsultorGoogle(consultorId: string): Promise<ConsultorGoogle | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("usuarios")
    .select("id, nome, email, google_agenda_sync")
    .eq("id", consultorId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ConsultorGoogle;
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
  };
}

async function buildEventDescription(comp: CompromissoRow): Promise<string> {
  const parts = [`Tipo: ${comp.tipo}`, "Origem: Gauchinho — Agenda comercial"];
  if (comp.descricao?.trim()) parts.push(comp.descricao.trim());
  if (comp.lead_id) {
    const admin = createAdminClient();
    const { data: lead } = await admin.from("leads").select("nome, whatsapp").eq("id", comp.lead_id).maybeSingle();
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

async function getAccessTokenForConsultor(
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
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agenda_compromissos")
    .select(
      "id, consultor_id, lead_id, titulo, descricao, tipo, data_inicio, data_fim, duracao_minutos, local, status, google_calendar_event_id",
    )
    .eq("id", compromissoId)
    .maybeSingle();
  if (error || !data) return null;
  return data as CompromissoRow;
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
  if (row.google_calendar_event_id) {
    return { synced: true, reason: "already_synced", eventId: row.google_calendar_event_id };
  }
  if (!row.consultor_id) return { synced: false, reason: "no_consultor" };

  const consultor = await loadConsultorGoogle(row.consultor_id);
  if (!consultor) return { synced: false, reason: "no_consultor" };
  if (!consultor.google_agenda_sync) {
    return resultBase(consultor, { synced: false, reason: "integration_disabled" });
  }
  if (!isGmailAddress(consultor.email)) {
    return resultBase(consultor, { synced: false, reason: "consultor_not_eligible" });
  }

  const tokenResult = await getAccessTokenForConsultor(consultor.id);
  if ("error" in tokenResult) {
    return resultBase(consultor, tokenResult.error);
  }

  try {
    const descricao = await buildEventDescription(row);
    const eventId = await createGoogleCalendarEvent(tokenResult.accessToken, buildEventInput(row, descricao));
    const admin = createAdminClient();
    await admin.from("agenda_compromissos").update({ google_calendar_event_id: eventId }).eq("id", row.id);
    logGoogleCalendar({ op: "push_success", compromissoId, consultorId: consultor.id, googleEventId: eventId });
    return resultBase(consultor, { synced: true, reason: "synced", eventId });
  } catch (e) {
    if (e instanceof GoogleCalendarAuthError && e.code === "transient") {
      return resultBase(consultor, { synced: false, reason: "google_temporary_error" });
    }
    logGoogleCalendarError({ op: "push_failed", compromissoId, consultorId: consultor.id, errorCode: "create" });
    return resultBase(consultor, { synced: false, reason: "google_error" });
  }
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

  const consultor = await loadConsultorGoogle(row.consultor_id);
  if (!consultor?.google_agenda_sync || !isGmailAddress(consultor.email)) {
    return resultBase(consultor, { synced: false, reason: "integration_disabled" });
  }

  const tokenResult = await getAccessTokenForConsultor(consultor.id);
  if ("error" in tokenResult) {
    return resultBase(consultor, tokenResult.error);
  }

  const descricao = await buildEventDescription(row);
  const input = buildEventInput(row, descricao);

  if (!row.google_calendar_event_id) {
    return pushCompromissoToGoogleCalendar(compromissoId);
  }

  try {
    await updateGoogleCalendarEvent(tokenResult.accessToken, row.google_calendar_event_id, input);
    logGoogleCalendar({
      op: "update_success",
      compromissoId,
      consultorId: consultor.id,
      googleEventId: row.google_calendar_event_id,
    });
    return resultBase(consultor, { synced: true, reason: "synced", eventId: row.google_calendar_event_id });
  } catch (e) {
    if (e instanceof Error && (e as Error & { code?: string }).code === "NOT_FOUND") {
      const admin = createAdminClient();
      await admin.from("agenda_compromissos").update({ google_calendar_event_id: null }).eq("id", row.id);
      return pushCompromissoToGoogleCalendar(compromissoId);
    }
    if (e instanceof GoogleCalendarAuthError && e.code === "transient") {
      return resultBase(consultor, { synced: false, reason: "google_temporary_error" });
    }
    logGoogleCalendarError({ op: "update_failed", compromissoId, consultorId: consultor.id });
    return resultBase(consultor, { synced: false, reason: "google_error" });
  }
}

export async function removeCompromissoFromGoogleCalendar(compromissoId: string): Promise<GoogleCalendarSyncResult> {
  logGoogleCalendar({ op: "remove_start", compromissoId });

  if (!isGoogleCalendarConfigured()) {
    return { synced: false, reason: "oauth_not_configured" };
  }

  const admin = createAdminClient();
  const comp = await loadCompromisso(compromissoId);
  if (!comp?.google_calendar_event_id || !comp.consultor_id) {
    return { synced: true, reason: "already_synced" };
  }

  const consultor = await loadConsultorGoogle(comp.consultor_id);
  const tokenResult = await getAccessTokenForConsultor(comp.consultor_id);

  if ("error" in tokenResult) {
    await admin.from("agenda_compromissos").update({ google_calendar_event_id: null }).eq("id", compromissoId);
    return resultBase(consultor, tokenResult.error);
  }

  try {
    await deleteGoogleCalendarEvent(tokenResult.accessToken, comp.google_calendar_event_id);
    logGoogleCalendar({
      op: "remove_success",
      compromissoId,
      consultorId: comp.consultor_id,
      googleEventId: comp.google_calendar_event_id,
    });
  } catch (e) {
    if (e instanceof GoogleCalendarAuthError && e.code === "transient") {
      return resultBase(consultor, { synced: false, reason: "google_temporary_error" });
    }
    logGoogleCalendarError({ op: "remove_failed", compromissoId, consultorId: comp.consultor_id });
  }

  await admin.from("agenda_compromissos").update({ google_calendar_event_id: null }).eq("id", compromissoId);
  return resultBase(consultor, { synced: true, reason: "synced" });
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
