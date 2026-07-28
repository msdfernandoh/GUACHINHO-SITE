import Link from "next/link";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import { fetchSrdOptions } from "@/app/admin/leads/actions";
import { getGoogleCalendarSetupInfo } from "@/lib/google-calendar/config";
import { fetchCompromissosRange, fetchGoogleCalendarStatusForCurrentUser, fetchLeadAgendaPreview } from "./actions";
import { fetchDisponibilidadeConsultores } from "./disponibilidade/actions";
import { GoogleCalendarAgendaBanner } from "@/components/admin/agenda/google-calendar-banner";
import { adminPageSubtitleClass, adminPageTitleClass } from "@/components/admin/admin-contrast";
import { AgendaView } from "@/components/admin/agenda/agenda-view";
import type { DisponibilidadeConsultor } from "@/lib/agenda/disponibilidade";

export default async function AgendaAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    mes?: string;
    ano?: string;
    lead?: string;
    dia?: string;
    google?: string;
    sync_flash?: string;
    sync_nome?: string;
  }>;
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
    fetchGoogleCalendarStatusForCurrentUser().catch(() => {
      const setup = getGoogleCalendarSetupInfo();
      return {
        configured: setup.configured,
        eligible: false,
        syncEnabled: false,
        connected: false,
        googleEmail: null,
        connectedAt: null,
        requiresReconnect: false,
        oauthRedirectUri: setup.oauthRedirectUri,
        hasClientId: setup.hasClientId,
        hasClientSecret: setup.hasClientSecret,
      };
    }),
  ]);

  const dispRaw = await fetchDisponibilidadeConsultores(srds.map((s) => s.id)).catch(() => []);
  const byId = new Map(dispRaw.map((d) => [d.usuarioId, d]));
  const disponibilidades: DisponibilidadeConsultor[] = srds.map((s) => {
    const found = byId.get(s.id);
    return {
      usuarioId: s.id,
      nome: s.nome,
      observacao: found?.observacao ?? null,
      modalidadePadrao: found?.modalidadePadrao ?? "ambos",
      slots: found?.slots ?? [],
      bloqueios: found?.bloqueios ?? [],
    };
  });

  return (
    <div className="space-y-6 pb-24 sm:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={adminPageTitleClass}>Agenda comercial</h1>
          <p className={adminPageSubtitleClass}>Compromissos com leads — clique no dia para agendar</p>
        </div>
        <Link
          href="/admin/agenda/disponibilidade"
          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-amber-300 hover:border-amber-500/50"
        >
          Configurar minha disponibilidade
        </Link>
      </div>
      <GoogleCalendarAgendaBanner
        status={googleStatus}
        flash={sp.google ?? null}
        syncFlash={sp.sync_flash ?? null}
        syncNome={sp.sync_nome ?? null}
      />
      <AgendaView
        month={month}
        year={year}
        compromissos={compromissos}
        srds={srds}
        disponibilidades={disponibilidades}
        initialDay={sp.dia ?? (sp.lead ? new Date().toISOString().slice(0, 10) : undefined)}
        initialLeadId={sp.lead}
        leadPreview={leadPreview}
      />
    </div>
  );
}
