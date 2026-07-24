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
  if (!res.ok) return null;
  const json = (await res.json()) as { email?: string };
  return json.email?.trim().toLowerCase() ?? null;
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
};

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
    body: JSON.stringify(eventBody(input)),
  });
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

function eventBody(input: GoogleCalendarEventInput) {
  return {
    summary: input.titulo,
    description: input.descricao ?? undefined,
    location: input.local ?? undefined,
    start: { dateTime: input.dataInicioIso, timeZone: "America/Sao_Paulo" },
    end: { dateTime: input.dataFimIso, timeZone: "America/Sao_Paulo" },
  };
}
