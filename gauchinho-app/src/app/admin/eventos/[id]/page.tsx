import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageImobiliarias, isMaster } from "@/lib/auth/permissions";
import {
  deleteEventoPostAction,
  fetchEventoLeadsUsuariosIds,
  fetchUsuariosStaffAtivos,
  eventoVagasResumo,
  fetchEventoAdmin,
  fetchEventoPosts,
  saveEventoPostAction,
  updateEventoAction,
} from "../actions";
import { EventoAdminForm } from "@/components/admin/eventos/evento-admin-form";
import { EventoQrCheckinModal } from "@/components/admin/eventos/evento-qr-checkin-modal";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { Button, Input, Label, Textarea } from "@/components/ui/form-primitives";
import { EVENTOS_INSCRICAO_MIGRATION_HINT } from "@/lib/comercial-eventos/db-ready";
import type { EventoPostRow } from "@/lib/comercial-eventos/types";
import {
  fetchVinculoAtivoDoEvento,
  listQrCodesDisponiveisParaEvento,
} from "@/lib/eventos-sorteio/qr-unico";

export default async function EditarEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await getUsuarioNegocio();
  if (!canManageImobiliarias(u?.perfil)) redirect("/admin");
  const master = isMaster(u?.perfil);
  const { id } = await params;
  let evento;
  try {
    evento = await fetchEventoAdmin(id);
  } catch {
    notFound();
  }
  const [posts, vagas, usuariosStaff, leadsUsuariosIds] = await Promise.all([
    fetchEventoPosts(id).catch(() => [] as EventoPostRow[]),
    eventoVagasResumo(id, evento.limite_participantes).catch(() => ({
      usadas: 0,
      limite: evento.limite_participantes,
      restantes: evento.limite_participantes,
    })),
    fetchUsuariosStaffAtivos().catch(() => [] as { id: string; nome: string }[]),
    fetchEventoLeadsUsuariosIds(id).catch(() => [] as string[]),
  ]);

  let qrDisponiveis: Awaited<ReturnType<typeof listQrCodesDisponiveisParaEvento>> = [];
  let qrVinculo: Awaited<ReturnType<typeof fetchVinculoAtivoDoEvento>> = null;
  try {
    [qrDisponiveis, qrVinculo] = await Promise.all([
      listQrCodesDisponiveisParaEvento(id),
      fetchVinculoAtivoDoEvento(id),
    ]);
  } catch {
    // Migration 030 ainda não aplicada — formulário segue sem QR
  }

  const inscricaoMigrationPending =
    evento.inscricao_tipo === undefined && evento.inscricao_url_externa === undefined;
  const savePost = saveEventoPostAction.bind(null, id);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/eventos" className="text-sm text-amber-600 hover:underline">
            ← Eventos
          </Link>
          <div className="mt-2 flex items-center gap-2">
            <h1 className="text-2xl font-bold">{evento.nome}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                evento.checkin_interativo_ativo
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {evento.checkin_interativo_ativo ? "Check-in Interativo" : "Check-in Tradicional"}
            </span>
          </div>
          <p className="text-sm text-zinc-500">
            Vagas: {vagas.usadas}
            {vagas.limite ? ` / ${vagas.limite}` : " (sem limite)"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Ações Primárias de Ver/Testar Check-in */}
          <a
            href={`/eventos/${encodeURIComponent(evento.slug)}/sorteio`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
          >
            <span>Ver check-in</span>
            <span className="text-[10px]">↗</span>
          </a>
          <a
            href={`/eventos/${encodeURIComponent(evento.slug)}/sorteio?preview=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-xl border border-emerald-600/40 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 dark:bg-zinc-900 dark:text-emerald-200 dark:hover:bg-zinc-800 transition"
            title="Navegar pelas telas sem gravar dados reais"
          >
            <span>Testar check-in (Preview)</span>
            <span className="text-[10px]">↗</span>
          </a>
          <EventoQrCheckinModal
            evento={{
              id: evento.id,
              nome: evento.nome,
              slug: evento.slug,
              checkinInterativoAtivo: evento.checkin_interativo_ativo,
              publicado: evento.publicado,
            }}
            qrVinculo={
              qrVinculo
                ? {
                    qrId: qrVinculo.qr_code_id,
                    qrNome: qrVinculo.qr.nome,
                    qrSlug: qrVinculo.qr.slug,
                  }
                : null
            }
            buttonVariant="default"
            buttonSize="sm"
            label="QR Check-in"
          />
          <a
            href={`/eventos/${encodeURIComponent(evento.slug)}/telao`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-xl border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-500/20 dark:text-purple-300 transition"
          >
            <span>Telão</span>
            <span className="text-[10px]">↗</span>
          </a>
          <Link href={`/admin/eventos/${id}/participantes`}>
            <Button variant="outline" size="sm">Participantes</Button>
          </Link>
          <Link href={`/admin/eventos/${id}/sorteio#nps-config`}>
            <Button variant="outline" size="sm">Sorteio / NPS</Button>
          </Link>
          <Link href={`/admin/eventos/nps?evento_id=${id}`}>
            <Button variant="outline" size="sm">Dashboard NPS</Button>
          </Link>
        </div>
      </div>

      {inscricaoMigrationPending ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          {EVENTOS_INSCRICAO_MIGRATION_HINT}
        </div>
      ) : null}

      <EventoAdminForm
        evento={evento}
        action={updateEventoAction}
        usuariosStaff={usuariosStaff}
        leadsUsuariosIds={leadsUsuariosIds}
        qrDisponiveis={qrDisponiveis}
        qrVinculo={qrVinculo}
        isMaster={master}
      />

      <section className="max-w-2xl space-y-4 rounded-xl border p-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Posts / fotos (página social)</h2>
        <ul className="space-y-3">
          {posts.map((p) => {
            const del = deleteEventoPostAction.bind(null, id, p.id);
            return (
              <li key={p.id} className="rounded-lg border p-3 text-sm dark:border-zinc-800">
                <p className="font-medium">{p.titulo ?? "Sem título"}</p>
                <p className="text-zinc-500 line-clamp-2">{p.conteudo ?? ""}</p>
                <form action={del} className="mt-2">
                  <Button type="submit" size="sm" variant="danger">
                    Excluir post
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
        <form action={savePost} className="space-y-3 border-t pt-4 dark:border-zinc-800">
          <h3 className="font-medium">Novo post</h3>
          <div>
            <Label>Título</Label>
            <Input name="titulo" />
          </div>
          <div>
            <Label>Texto</Label>
            <Textarea name="conteudo" rows={3} />
          </div>
          <div>
            <Label>URL da imagem</Label>
            <Input name="imagem_url" />
          </div>
          <div>
            <Label>Ordem</Label>
            <Input name="ordem" type="number" defaultValue="0" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="publicado" defaultChecked /> Publicado
          </label>
          <AdminFormSubmitButton label="Adicionar post" pendingLabel="Adicionando…" />
        </form>
      </section>
    </div>
  );
}
