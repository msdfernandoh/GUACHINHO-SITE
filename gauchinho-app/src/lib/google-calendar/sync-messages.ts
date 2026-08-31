import type { GoogleCalendarSyncReason } from "./types";

export function formatGoogleSyncUserMessage(
  reason: GoogleCalendarSyncReason,
  consultorNome: string,
  synced: boolean,
): string | undefined {
  if (synced && reason === "synced") {
    return "Compromisso sincronizado com as Google Agendas dos participantes.";
  }
  const nome = consultorNome.trim() || "Consultor";
  switch (reason) {
    case "consultor_not_connected":
      return `Compromisso salvo no sistema, mas ${nome} ainda não conectou a Google Agenda.`;
    case "requires_reconnect":
      return `Compromisso salvo no sistema, mas ${nome} precisa reconectar a Google Agenda.`;
    case "integration_disabled":
      return `Compromisso salvo no sistema. A sincronização Google não está habilitada para ${nome}.`;
    case "consultor_not_eligible":
      return `Compromisso salvo no sistema. ${nome} precisa de e-mail Gmail para sincronizar.`;
    case "oauth_not_configured":
      return "Compromisso salvo no sistema. Integração Google não configurada no servidor.";
    case "google_temporary_error":
      return "Compromisso salvo no sistema. Não foi possível sincronizar com o Google agora; tente novamente em instantes.";
    case "google_error":
      return "Compromisso salvo no sistema, mas a sincronização Google ficou incompleta. Confira a conta conectada e tente novamente.";
    default:
      return undefined;
  }
}

export function appendSyncResultToSearchParams(
  qs: URLSearchParams,
  result: { synced: boolean; reason: GoogleCalendarSyncReason; consultorNome?: string; userMessage?: string },
): void {
  if (result.synced && result.reason === "synced") {
    qs.set("sync_flash", "synced");
    return;
  }
  if (result.userMessage || result.reason !== "synced") {
    qs.set("sync_flash", result.reason);
    if (result.consultorNome) qs.set("sync_nome", result.consultorNome);
  }
}
