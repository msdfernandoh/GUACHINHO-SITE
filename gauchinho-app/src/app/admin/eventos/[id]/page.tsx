import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageImobiliarias } from "@/lib/auth/permissions";
import {
  deleteEventoPostAction,
  eventoVagasResumo,
  fetchEventoAdmin,
  fetchEventoPosts,
  saveEventoPostAction,
  updateEventoAction,
} from "../actions";
import { EventoAdminForm } from "@/components/admin/eventos/evento-admin-form";
import { Button, Input, Label, Textarea } from "@/components/ui/form-primitives";

export default async function EditarEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await getUsuarioNegocio();
  if (!canManageImobiliarias(u?.perfil)) redirect("/admin");
  const { id } = await params;
  let evento;
  try {
    evento = await fetchEventoAdmin(id);
  } catch {
    notFound();
  }
  const [posts, vagas] = await Promise.all([
    fetchEventoPosts(id),
    eventoVagasResumo(id, evento.limite_participantes),
  ]);
  const update = updateEventoAction.bind(null, id);
  const savePost = saveEventoPostAction.bind(null, id);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/eventos" className="text-sm text-amber-600 hover:underline">
            ← Eventos
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{evento.nome}</h1>
          <p className="text-sm text-zinc-500">
            Vagas: {vagas.usadas}
            {vagas.limite ? ` / ${vagas.limite}` : " (sem limite)"}
          </p>
        </div>
        <Link href={`/admin/eventos/${id}/participantes`}>
          <Button variant="outline">Participantes</Button>
        </Link>
      </div>

      <EventoAdminForm evento={evento} action={update} />

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
          <Button type="submit">Adicionar post</Button>
        </form>
      </section>
    </div>
  );
}
