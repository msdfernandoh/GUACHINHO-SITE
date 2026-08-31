import Link from "next/link";
import { randomUUID } from "node:crypto";
import { fetchSrdOptions } from "@/app/admin/leads/actions";
import { getGoogleCalendarSetupInfo } from "@/lib/google-calendar/config";
import { fetchAgendaLeadOptions, fetchCompromissosRange, fetchGoogleCalendarStatusForCurrentUser, fetchLeadAgendaPreview, podeOperarEquipeAgenda } from "./actions";
import { fetchDisponibilidadeConsultores } from "./disponibilidade/actions";
import { GoogleCalendarAgendaBanner } from "@/components/admin/agenda/google-calendar-banner";
import { adminPageSubtitleClass, adminPageTitleClass } from "@/components/admin/admin-contrast";
import { AgendaView } from "@/components/admin/agenda/agenda-view";
import type { DisponibilidadeConsultor } from "@/lib/agenda/disponibilidade";
import { requireTenantPermission } from "@/lib/tenant/context";
import { agendaDateKey, agendaLocalDateTimeToIso } from "@/lib/agenda/timezone";

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
  const agendaContext = await requireTenantPermission("acessar_agenda");
  const sp = await searchParams;
  const today = agendaDateKey(new Date());
  const requestedYear = Number(sp.ano ?? today.slice(0, 4));
  const requestedMonth = Number(sp.mes ?? today.slice(5, 7));
  const year = Number.isInteger(requestedYear) && requestedYear >= 1900 && requestedYear <= 9998 ? requestedYear : Number(today.slice(0, 4));
  const month = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : Number(today.slice(5, 7));
  const from = agendaLocalDateTimeToIso(`${year}-${String(month).padStart(2, "0")}-01`, "00:00");
  const to = agendaLocalDateTimeToIso(`${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`, "00:00");
  const canViewTeam = await podeOperarEquipeAgenda();
  const leadPreview = sp.lead ? await fetchLeadAgendaPreview(sp.lead).catch(() => null) : null;
  const [compromissos, srds, googleStatus, leadOptions] = await Promise.all([
    fetchCompromissosRange(from, to),
    fetchSrdOptions().then((rows) => canViewTeam ? rows : rows.filter((s) => s.id === agendaContext.usuario.id)),
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
    fetchAgendaLeadOptions().catch(() => []),
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
          <p className={adminPageSubtitleClass}>Compromissos individuais e de equipe · fuso de Cuiabá (UTC−4)</p>
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
        key={`${year}-${month}-${sp.dia ?? ""}`}
        requestId={randomUUID()}
        month={month}
        year={year}
        compromissos={compromissos}
        srds={srds}
        disponibilidades={disponibilidades}
        initialDay={sp.dia ?? (today.startsWith(`${year}-${String(month).padStart(2, "0")}`) ? today : undefined)}
        initialLeadId={sp.lead}
        leadPreview={leadPreview}
        currentUserId={agendaContext.usuario.id}
        canViewTeam={canViewTeam}
        leadOptions={leadOptions}
      />
    </div>
  );
}
