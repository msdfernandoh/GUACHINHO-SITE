import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGmailAddress, isGoogleCalendarConfigured } from "./config";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  refreshGoogleAccessToken,
} from "./client";

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

async function loadConsultorGoogle(consultorId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("usuarios")
    .select("id, email, google_agenda_sync, google_calendar_refresh_token")
    .eq("id", consultorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as {
    id: string;
    email: string;
    google_agenda_sync: boolean;
    google_calendar_refresh_token: string | null;
  } | null;
}

function canSyncConsultor(consultor: {
  email: string;
  google_agenda_sync: boolean;
  google_calendar_refresh_token: string | null;
}): boolean {
  return (
    isGoogleCalendarConfigured() &&
    consultor.google_agenda_sync &&
    !!consultor.google_calendar_refresh_token &&
    isGmailAddress(consultor.email)
  );
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

/** Cria evento no Google Agenda do consultor responsável (não bloqueia o fluxo principal). */
export async function pushCompromissoToGoogleCalendar(compromissoId: string): Promise<void> {
  if (!isGoogleCalendarConfigured()) return;

  const admin = createAdminClient();
  const { data: comp, error } = await admin
    .from("agenda_compromissos")
    .select(
      "id, consultor_id, lead_id, titulo, descricao, tipo, data_inicio, data_fim, duracao_minutos, local, status, google_calendar_event_id",
    )
    .eq("id", compromissoId)
    .maybeSingle();
  if (error || !comp) return;
  const row = comp as CompromissoRow;
  if (row.status !== "agendado" || row.google_calendar_event_id || !row.consultor_id) return;

  const consultor = await loadConsultorGoogle(row.consultor_id);
  if (!consultor || !canSyncConsultor(consultor)) return;

  const accessToken = await refreshGoogleAccessToken(consultor.google_calendar_refresh_token!);
  const dataFim =
    row.data_fim ??
    new Date(
      new Date(row.data_inicio).getTime() + (row.duracao_minutos ?? 60) * 60_000,
    ).toISOString();

  const eventId = await createGoogleCalendarEvent(accessToken, {
    titulo: row.titulo,
    descricao: await buildEventDescription(row),
    local: row.local,
    dataInicioIso: row.data_inicio,
    dataFimIso: dataFim,
  });

  await admin.from("agenda_compromissos").update({ google_calendar_event_id: eventId }).eq("id", row.id);
}

export async function removeCompromissoFromGoogleCalendar(compromissoId: string): Promise<void> {
  if (!isGoogleCalendarConfigured()) return;

  const admin = createAdminClient();
  const { data: comp } = await admin
    .from("agenda_compromissos")
    .select("id, consultor_id, google_calendar_event_id")
    .eq("id", compromissoId)
    .maybeSingle();
  if (!comp?.google_calendar_event_id || !comp.consultor_id) return;

  const consultor = await loadConsultorGoogle(comp.consultor_id as string);
  if (!consultor?.google_calendar_refresh_token) return;

  try {
    const accessToken = await refreshGoogleAccessToken(consultor.google_calendar_refresh_token);
    await deleteGoogleCalendarEvent(accessToken, comp.google_calendar_event_id as string);
  } catch (e) {
    console.error("[google-calendar] remove:", e);
  }

  await admin
    .from("agenda_compromissos")
    .update({ google_calendar_event_id: null })
    .eq("id", compromissoId);
}
