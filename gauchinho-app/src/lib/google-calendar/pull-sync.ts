import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { agendaLocalDateTimeToIso } from "@/lib/agenda/timezone";
import { fetchGoogleAccountEmail, getGoogleCalendarEvent, listGoogleCalendarEvents, type GoogleCalendarEvent } from "./client";
import { getAccessTokenForConsultor } from "./sync";

export type GooglePullResult = { imported: number; updated: number; cancelled: number; skipped: number };

export function normalizeGoogleEvent(event: GoogleCalendarEvent) {
  if (!event.id || event.extendedProperties?.private?.gauchinhoCompromissoId) return null;
  const base = { id: event.id, updated: event.updated ?? new Date().toISOString(), status: event.status,
    privado: event.visibility === "private" || event.visibility === "confidential" };
  if (base.privado || event.status === "cancelled") return base;
  const diaInteiro = Boolean(event.start?.date);
  if (!(event.start?.date || event.start?.dateTime) || !(event.end?.date || event.end?.dateTime)) return null;
  const inicio = diaInteiro ? agendaLocalDateTimeToIso(event.start!.date!, "00:00") : new Date(event.start!.dateTime!).toISOString();
  const fim = diaInteiro ? agendaLocalDateTimeToIso(event.end!.date!, "00:00") : new Date(event.end!.dateTime!).toISOString();
  if (Date.parse(fim) <= Date.parse(inicio)) throw new Error("Google retornou um compromisso com término inválido.");
  return { ...base, inicio, fim, diaInteiro, titulo: event.summary?.trim() || "Compromisso Google",
    descricao: event.description?.trim() || null, local: event.location?.trim() || null };
}

export async function pullGoogleCalendarToAgenda(empresaId: string, usuarioId: string): Promise<GooglePullResult> {
  const admin = createAdminClient();
  const { data: link, error: linkError } = await admin.from("empresa_usuarios")
    .select("google_agenda_bidirecional,google_agenda_sync").eq("empresa_id", empresaId).eq("usuario_id", usuarioId).eq("ativo", true).maybeSingle();
  if (linkError) throw new Error("Não foi possível validar a integração.");
  if (!link?.google_agenda_bidirecional || !link.google_agenda_sync) throw new Error("Importação Google não está habilitada nesta empresa.");
  const { data: state, error: stateError } = await admin.from("agenda_google_sync_estado")
    .select("google_email,sync_token").eq("empresa_id", empresaId).eq("usuario_id", usuarioId).single();
  if (stateError) throw new Error("Ative a importação antes de sincronizar.");
  try {
    const { error: permissionError } = await admin.rpc("rpc_agenda_importar_google", {
      p_empresa_id: empresaId, p_usuario_id: usuarioId, p_email: state.google_email, p_eventos: [],
    });
    if (permissionError) throw new Error("Importação sem autorização vigente nesta empresa.");
    const token = await getAccessTokenForConsultor(usuarioId);
    if ("error" in token) throw new Error("Reconecte sua Google Agenda antes de importar.");
    const email = await fetchGoogleAccountEmail(token.accessToken);
    if (!email || email !== state.google_email) throw new Error("A conta Google mudou. Desative e autorize novamente a importação.");
    const listed = await listGoogleCalendarEvents(token.accessToken, state.sync_token);
    const events = listed.events;
    const ids = new Set(events.map((e) => e.id));
    // Ausência na janela não significa exclusão: confira o evento de origem.
    const { data: tracked, error: trackedError } = await admin.from("agenda_compromissos")
      .select("google_calendar_event_id").eq("empresa_id", empresaId).eq("consultor_id", usuarioId)
      .eq("origem", "GOOGLE").eq("google_conta_email", email).eq("status", "agendado");
    if (trackedError) throw new Error("Não foi possível conferir compromissos importados.");
    for (const row of tracked ?? []) {
      if (row.google_calendar_event_id && !ids.has(row.google_calendar_event_id)) {
        events.push(await getGoogleCalendarEvent(token.accessToken, row.google_calendar_event_id));
      }
    }
    const normalized = events.map(normalizeGoogleEvent).filter((e) => e !== null);
    const result: GooglePullResult = { imported: 0, updated: 0, cancelled: 0, skipped: events.length - normalized.length };
    for (let offset = 0; offset < normalized.length; offset += 100) {
      const { data, error } = await admin.rpc("rpc_agenda_importar_google", {
        p_empresa_id: empresaId, p_usuario_id: usuarioId, p_email: email, p_eventos: normalized.slice(offset, offset + 100),
      });
      if (error) throw new Error("Não foi possível salvar a importação. Os lotes confirmados serão reconhecidos na próxima tentativa.");
      result.imported += data.imported; result.updated += data.updated; result.cancelled += data.cancelled;
    }
    const { error } = await admin.from("agenda_google_sync_estado").update({
      ultima_sincronizacao: new Date().toISOString(), ultimo_erro: null,
      sync_token: listed.nextSyncToken,
    }).eq("empresa_id", empresaId).eq("usuario_id", usuarioId);
    if (error) throw new Error("Importação processada, mas não foi possível registrar a confirmação.");
    return result;
  } catch (error) {
    await admin.from("agenda_google_sync_estado").update({ ultimo_erro: "Sincronização incompleta. Tente novamente; confira a conexão e o consentimento." })
      .eq("empresa_id", empresaId).eq("usuario_id", usuarioId);
    throw error;
  }
}

export async function pullAllEnabledGoogleCalendars(): Promise<{ users: number; errors: number }> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("empresa_usuarios").select("empresa_id,usuario_id")
    .eq("ativo", true).eq("google_agenda_bidirecional", true).eq("google_agenda_sync", true);
  if (error) throw new Error("Falha ao consultar integrações habilitadas.");
  let errors = 0;
  for (const link of data ?? []) {
    try { await pullGoogleCalendarToAgenda(link.empresa_id as string, link.usuario_id as string); }
    catch { errors += 1; }
  }
  return { users: data?.length ?? 0, errors };
}
