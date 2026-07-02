import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import { fetchSrdOptions } from "@/app/admin/leads/actions";
import { fetchCompromissosRange } from "./actions";
import { AgendaView } from "@/components/admin/agenda/agenda-view";

export default async function AgendaAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string; lead?: string; dia?: string }>;
}) {
  await requireStaffAdmin();
  const sp = await searchParams;
  const now = new Date();
  const year = parseInt(sp.ano ?? String(now.getFullYear()), 10);
  const month = parseInt(sp.mes ?? String(now.getMonth() + 1), 10);
  const from = new Date(year, month - 1, 1).toISOString();
  const to = new Date(year, month, 0, 23, 59, 59).toISOString();
  const [compromissos, srds] = await Promise.all([fetchCompromissosRange(from, to), fetchSrdOptions()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Agenda comercial</h1>
        <p className="text-sm text-zinc-500">Compromissos com leads — clique no dia para agendar</p>
      </div>
      <AgendaView
        month={month}
        year={year}
        compromissos={compromissos}
        srds={srds}
        initialDay={sp.dia}
        initialLeadId={sp.lead}
      />
    </div>
  );
}
