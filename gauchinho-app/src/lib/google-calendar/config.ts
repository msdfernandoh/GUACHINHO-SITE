import "server-only";
import { isGmailAddress } from "./email";

export { isGmailAddress };

/** Lê variável de ambiente (servidor) — aceita nomes alternativos comuns na Vercel. */
function readServerEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

export function getGoogleCalendarClientId(): string {
  return readServerEnv("GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CLIENT_ID");
}

export function getGoogleCalendarClientSecret(): string {
  return readServerEnv("GOOGLE_CALENDAR_CLIENT_SECRET", "GOOGLE_CLIENT_SECRET");
}

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(getGoogleCalendarClientId() && getGoogleCalendarClientSecret());
}

export function getGoogleCalendarRedirectUri(): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/auth/google-calendar/callback`;
}

export const GOOGLE_CALENDAR_SCOPE = "openid email https://www.googleapis.com/auth/calendar.events";

export type GoogleCalendarSetupInfo = {
  configured: boolean;
  oauthRedirectUri: string;
  siteUrl: string;
  hasClientId: boolean;
  hasClientSecret: boolean;
};

export function getGoogleCalendarSetupInfo(): GoogleCalendarSetupInfo {
  const clientId = getGoogleCalendarClientId();
  const clientSecret = getGoogleCalendarClientSecret();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "") || "http://localhost:3000";
  return {
    configured: Boolean(clientId && clientSecret),
    oauthRedirectUri: getGoogleCalendarRedirectUri(),
    siteUrl,
    hasClientId: Boolean(clientId),
    hasClientSecret: Boolean(clientSecret),
  };
}
