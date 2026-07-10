import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageImobiliarias } from "@/lib/auth/permissions";
import { fetchEventoAdmin } from "@/app/admin/eventos/actions";
import { SorteioAdminClient } from "@/components/admin/eventos/sorteio-admin-client";
import {
  fetchParticipantesSorteioAdmin,
  fetchSorteioAdminByEventoId,
} from "@/lib/eventos-sorteio/public";
import { EVENTOS_SORTEIO_MIGRATION_HINT } from "@/lib/comercial-eventos/db-ready";

export default async function EventoSorteioAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await getUsuarioNegocio();
  if (!canManageImobiliarias(u?.perfil)) redirect("/admin");
  const { id } = await params;
  let evento;
  try {
    evento = await fetchEventoAdmin(id);
  } catch {
    notFound();
  }

  let sorteio = null;
  let participantes: Awaited<ReturnType<typeof fetchParticipantesSorteioAdmin>> = [];
  let migrationHint: string | null = null;
  try {
    sorteio = await fetchSorteioAdminByEventoId(id);
    if (sorteio?.id) {
      participantes = await fetchParticipantesSorteioAdmin(sorteio.id, id);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/eventos_sorteios|does not exist|Could not find|evento_participante_id/i.test(msg)) {
      migrationHint = EVENTOS_SORTEIO_MIGRATION_HINT;
    } else {
      throw e;
    }
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const publicBaseUrl = `${proto}://${host}`;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/eventos/${id}`} className="text-sm text-amber-600 hover:underline">
          ← {evento.nome}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Sorteio / Brindes</h1>
        <p className="text-sm text-zinc-500">Captura de leads e sorteio presencial com QR Code.</p>
      </div>
      <SorteioAdminClient
        eventoId={id}
        eventoNome={evento.nome}
        eventoSlug={evento.slug}
        publicBaseUrl={publicBaseUrl}
        sorteio={sorteio}
        participantes={participantes}
        migrationHint={migrationHint}
      />
    </div>
  );
}
