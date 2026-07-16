import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageImobiliarias } from "@/lib/auth/permissions";
import { NpsDashboardClient } from "@/components/admin/eventos/nps-dashboard-client";
import {
  fetchNpsDashboard,
  listEventosComSorteioParaNps,
} from "@/lib/eventos-sorteio/nps-dashboard";
import { EVENTOS_SORTEIO_MIGRATION_HINT } from "@/lib/comercial-eventos/db-ready";

export default async function EventosNpsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ evento_id?: string }>;
}) {
  const u = await getUsuarioNegocio();
  if (!canManageImobiliarias(u?.perfil)) redirect("/admin");

  const { evento_id: eventoId } = await searchParams;
  let eventos: Awaited<ReturnType<typeof listEventosComSorteioParaNps>> = [];
  let data: Awaited<ReturnType<typeof fetchNpsDashboard>> = null;
  let migrationHint: string | null = null;

  try {
    eventos = await listEventosComSorteioParaNps();
    if (eventoId) {
      data = await fetchNpsDashboard(eventoId);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/eventos_sorteio|nps_|does not exist|schema cache/i.test(msg)) {
      migrationHint = EVENTOS_SORTEIO_MIGRATION_HINT;
    } else {
      throw e;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/eventos" className="text-sm text-amber-600 hover:underline">
          ← Eventos
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Dashboard NPS e indicações</h1>
        <p className="text-sm text-zinc-500">
          Respostas do formulário de sorteio, score NPS e indicações por evento.
        </p>
      </div>

      {migrationHint ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {migrationHint}
        </div>
      ) : (
        <NpsDashboardClient
          eventos={eventos}
          selectedEventoId={eventoId ?? null}
          data={data}
        />
      )}
    </div>
  );
}
