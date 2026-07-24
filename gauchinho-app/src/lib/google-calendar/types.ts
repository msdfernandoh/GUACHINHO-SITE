export type GoogleCalendarSyncReason =
  | "synced"
  | "already_synced"
  | "integration_disabled"
  | "oauth_not_configured"
  | "no_consultor"
  | "consultor_not_eligible"
  | "consultor_not_connected"
  | "requires_reconnect"
  | "google_temporary_error"
  | "google_error"
  | "not_agendado";

export type GoogleCalendarSyncResult = {
  synced: boolean;
  reason: GoogleCalendarSyncReason;
  eventId?: string;
  requiresReconnect?: boolean;
  consultorId?: string;
  consultorNome?: string;
  userMessage?: string;
};

export class GoogleCalendarAuthError extends Error {
  readonly code: "invalid_grant" | "transient" | "unknown";

  constructor(code: GoogleCalendarAuthError["code"], message: string) {
    super(message);
    this.name = "GoogleCalendarAuthError";
    this.code = code;
  }
}
