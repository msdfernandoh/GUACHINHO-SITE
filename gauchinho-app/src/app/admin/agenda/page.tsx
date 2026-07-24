import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import { fetchSrdOptions } from "@/app/admin/leads/actions";
import { fetchCompromissosRange, fetchGoogleCalendarStatusForCurrentUser, fetchLeadAgendaPreview } from "./actions";
import { GoogleCalendarAgendaBanner } from "@/components/admin/agenda/google-calendar-banner";
import { adminPageSubtitleClass, adminPageTitleClass } from "@/components/admin/admin-contrast";
import { AgendaView } from "@/components/admin/agenda/agenda-view";

export default async function AgendaAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string; lead?: string; dia?: string; google?: string }>;
}) {
  await requireStaffAdmin();
  const sp = await searchParams;
  const now = new Date();
  const year = parseInt(sp.ano ?? String(now.getFullYear()), 10);
  const month = parseInt(sp.mes ?? String(now.getMonth() + 1), 10);
  const from = new Date(year, month - 1, 1).toISOString();
  const to = new Date(year, month, 0, 23, 59, 59).toISOString();
  const leadPreview = sp.lead ? await fetchLeadAgendaPreview(sp.lead).catch(() => null) : null;
  const [compromissos, srds, googleStatus] = await Promise.all([
    fetchCompromissosRange(from, to),
    fetchSrdOptions(),
    fetchGoogleCalendarStatusForCurrentUser().catch(() => ({
      configured: false,
      eligible: false,
      syncEnabled: false,
      connected: false,
    })),
  ]);

  return (
    <div className="space-y-6 pb-24 sm:pb-0">
      <div>
        <h1 className={adminPageTitleClass}>Agenda comercial</h1>
        <p className={adminPageSubtitleClass}>Compromissos com leads — clique no dia para agendar</p>
      </div>
      <GoogleCalendarAgendaBanner status={googleStatus} flash={sp.google ?? null} />
      <AgendaView
        month={month}
        year={year}
        compromissos={compromissos}
        srds={srds}
        initialDay={sp.dia ?? (sp.lead ? new Date().toISOString().slice(0, 10) : undefined)}
        initialLeadId={sp.lead}
        leadPreview={leadPreview}
      />
    </div>
  );
}
