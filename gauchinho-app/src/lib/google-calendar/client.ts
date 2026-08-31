import "server-only";
import {
  getGoogleCalendarClientId,
  getGoogleCalendarClientSecret,
  getGoogleCalendarRedirectUri,
  GOOGLE_CALENDAR_SCOPE,
  isGoogleCalendarConfigured,
} from "./config";
import { GoogleCalendarAuthError } from "./types";
import { classifyGoogleTokenError } from "./auth-errors";
import { AGENDA_TIME_ZONE, agendaDateKey } from "@/lib/agenda/timezone";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

function classifyTokenError(json: TokenResponse, status: number): GoogleCalendarAuthError {
  const msg = json.error_description ?? json.error ?? "Erro OAuth Google";
  const kind = classifyGoogleTokenError(json, status);
  return new GoogleCalendarAuthError(kind, msg);
}

export function buildGoogleCalendarAuthUrl(state: string): string {
  if (!isGoogleCalendarConfigured()) {
    throw new Error("Google Calendar não configurado no servidor.");
  }
  const params = new URLSearchParams({
    client_id: getGoogleCalendarClientId(),
    redirect_uri: getGoogleCalendarRedirectUri(),
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleAuthCode(code: string): Promise<{
  refreshToken: string;
  accessToken: string;
}> {
  const body = new URLSearchParams({
    code,
    client_id: getGoogleCalendarClientId(),
    client_secret: getGoogleCalendarClientSecret(),
    redirect_uri: getGoogleCalendarRedirectUri(),
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || !json.refresh_token || !json.access_token) {
    throw classifyTokenError(json, res.status);
  }
  return { refreshToken: json.refresh_token, accessToken: json.access_token };
}

export async function fetchGoogleAccountEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.ok) {
    const json = (await res.json()) as { email?: string };
    if (json.email?.trim()) return json.email.trim().toLowerCase();
  }
  // Tokens antigos podem não incluir userinfo.email; o calendário principal
  // continua identificando a conta dentro do próprio escopo Calendar.
  const calendar = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary", {
    headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000), cache: "no-store",
  });
  if (!calendar.ok) return null;
  const json = await calendar.json() as { id?: string };
  return json.id?.includes("@") ? json.id.trim().toLowerCase() : null;
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: getGoogleCalendarClientId(),
    client_secret: getGoogleCalendarClientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || !json.access_token) {
    throw classifyTokenError(json, res.status);
  }
  return json.access_token;
}

export type GoogleCalendarEventInput = {
  titulo: string;
  descricao?: string | null;
  local?: string | null;
  dataInicioIso: string;
  dataFimIso: string;
  diaInteiro?: boolean;
  dataCivil?: string;
  compromissoId?: string;
  eventId?: string;
};

export type GoogleCalendarEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  updated?: string;
  visibility?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
};

export type GoogleCalendarListResult = { events: GoogleCalendarEvent[]; nextSyncToken: string | null; tokenExpired: boolean };

export async function createGoogleCalendarEvent(
  accessToken: string,
  input: GoogleCalendarEventInput,
): Promise<string> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...eventBody(input), id: input.eventId }),
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 409 && input.eventId) {
    await updateGoogleCalendarEvent(accessToken, input.eventId, input);
    return input.eventId;
  }
  const json = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !json.id) {
    if (res.status >= 500 || res.status === 429) {
      throw new GoogleCalendarAuthError("transient", json.error?.message ?? "Google indisponível");
    }
    throw new Error(json.error?.message ?? "Falha ao criar evento no Google Agenda.");
  }
  return json.id;
}

export async function updateGoogleCalendarEvent(
  accessToken: string,
  eventId: string,
  input: GoogleCalendarEventInput,
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody(input)),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (res.status === 404 || res.status === 410) {
    const err = new Error("google_event_not_found");
    (err as Error & { code?: string }).code = "NOT_FOUND";
    throw err;
  }
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (res.status >= 500 || res.status === 429) {
      throw new GoogleCalendarAuthError("transient", json.error?.message ?? "Google indisponível");
    }
    throw new Error(json.error?.message ?? "Falha ao atualizar evento no Google Agenda.");
  }
}

export async function deleteGoogleCalendarEvent(accessToken: string, eventId: string): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (res.status === 404 || res.status === 410) return;
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (res.status >= 500 || res.status === 429) {
      throw new GoogleCalendarAuthError("transient", json.error?.message ?? "Google indisponível");
    }
    throw new Error(json.error?.message ?? "Falha ao remover evento no Google Agenda.");
  }
}

export function eventBody(input: GoogleCalendarEventInput) {
  const start = input.diaInteiro
    ? { date: agendaDateKey(input.dataInicioIso) }
    : { dateTime: input.dataInicioIso, timeZone: AGENDA_TIME_ZONE };
  const end = input.diaInteiro
    ? { date: agendaDateKey(input.dataFimIso) }
    : { dateTime: input.dataFimIso, timeZone: AGENDA_TIME_ZONE };
  return {
    summary: input.titulo,
    description: input.descricao ?? undefined,
    location: input.local ?? undefined,
    start,
    end,
    extendedProperties: input.compromissoId
      ? { private: { gauchinhoCompromissoId: input.compromissoId, origem: "GAUCHINHO_SISTEMA" } }
      : undefined,
  };
}

export async function listGoogleCalendarEvents(
  accessToken: string,
  syncToken?: string | null,
): Promise<GoogleCalendarListResult> {
  const params = new URLSearchParams({ singleEvents: "true", showDeleted: "true", maxResults: "2500" });
  if (syncToken) params.set("syncToken", syncToken);
  else {
    params.set("timeMin", new Date(Date.now() - 30 * 86_400_000).toISOString());
    params.set("timeMax", new Date(Date.now() + 370 * 86_400_000).toISOString());
  }
  const events: GoogleCalendarEvent[] = [];
  for (let page = 0; page < 20; page += 1) {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000), cache: "no-store",
    });
    if (res.status === 410 && syncToken) return listGoogleCalendarEvents(accessToken, null).then((full) => ({ ...full, tokenExpired: true }));
    const json = (await res.json()) as { items?: GoogleCalendarEvent[]; nextPageToken?: string; nextSyncToken?: string };
    if (!res.ok) throw new Error("Falha ao consultar Google Agenda. Tente novamente ou reconecte sua conta.");
    events.push(...(json.items ?? []));
    if (!json.nextPageToken) return { events, nextSyncToken: json.nextSyncToken ?? null, tokenExpired: false };
    params.set("pageToken", json.nextPageToken);
  }
  throw new Error("Agenda excedeu o limite desta sincronização. Nenhum lote foi confirmado.");
}

export async function getGoogleCalendarEvent(accessToken: string, eventId: string): Promise<GoogleCalendarEvent> {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000), cache: "no-store",
  });
  if (res.status === 404 || res.status === 410) return { id: eventId, status: "cancelled", updated: new Date().toISOString() };
  if (!res.ok) throw new Error("Não foi possível conferir um compromisso já importado.");
  return await res.json() as GoogleCalendarEvent;
}
