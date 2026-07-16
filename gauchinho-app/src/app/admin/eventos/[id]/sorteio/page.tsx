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
import {
  fetchVinculoAtivoDoEvento,
  listQrCodesDisponiveisParaEvento,
} from "@/lib/eventos-sorteio/qr-unico";
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
  let qrDisponiveis: Awaited<ReturnType<typeof listQrCodesDisponiveisParaEvento>> = [];
  let qrVinculo: Awaited<ReturnType<typeof fetchVinculoAtivoDoEvento>> = null;
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

  try {
    [qrDisponiveis, qrVinculo] = await Promise.all([
      listQrCodesDisponiveisParaEvento(id),
      fetchVinculoAtivoDoEvento(id),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/qr_codes_unicos|does not exist|Could not find|schema cache/i.test(msg)) {
      migrationHint = migrationHint ?? EVENTOS_SORTEIO_MIGRATION_HINT;
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
        <h1 className="mt-2 text-2xl font-bold">Sorteio / Brindes / NPS</h1>
        <p className="text-sm text-zinc-500">
          Cadastro em 3 fases (dados + NPS + indicações) e sorteio presencial com QR Code.{" "}
          <Link href={`/admin/eventos/nps?evento_id=${id}`} className="text-amber-600 hover:underline">
            Abrir dashboard NPS
          </Link>
          {" · "}
          <a href="#nps-config" className="text-amber-600 hover:underline">
            Ir para perguntas NPS
          </a>
        </p>
      </div>
      <SorteioAdminClient
        eventoId={id}
        eventoNome={evento.nome}
        eventoSlug={evento.slug}
        publicBaseUrl={publicBaseUrl}
        sorteio={sorteio}
        participantes={participantes}
        migrationHint={migrationHint}
        qrDisponiveis={qrDisponiveis}
        qrVinculo={qrVinculo}
      />
    </div>
  );
}
