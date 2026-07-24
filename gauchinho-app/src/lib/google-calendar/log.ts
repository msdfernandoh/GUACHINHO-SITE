import "server-only";

type GoogleCalendarLogPayload = {
  op: string;
  usuarioId?: string;
  consultorId?: string;
  compromissoId?: string;
  googleEventId?: string;
  reason?: string;
  errorCode?: string;
};

/** Logs seguros — nunca incluir tokens ou códigos OAuth. */
export function logGoogleCalendar(payload: GoogleCalendarLogPayload): void {
  console.info("[google-calendar]", JSON.stringify(payload));
}

export function logGoogleCalendarError(payload: GoogleCalendarLogPayload): void {
  console.error("[google-calendar]", JSON.stringify(payload));
}
