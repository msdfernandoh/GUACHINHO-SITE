import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteCartaAction,
  fetchCarta,
  toggleCartaAtivoAction,
  updateCartaAction,
} from "../actions";
import { CartaFormFields } from "@/components/admin/carta-form-fields";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canDeleteRecords } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/form-primitives";

export default async function CartaEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await getUsuarioNegocio();
  let carta;
  try {
    carta = await fetchCarta(id);
  } catch {
    notFound();
  }

  const update = updateCartaAction.bind(null, id);
  const del = deleteCartaAction.bind(null, id);
  const toggleOff = toggleCartaAtivoAction.bind(null, id, false);
  const toggleOn = toggleCartaAtivoAction.bind(null, id, true);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/cartas-contempladas" className="text-sm text-amber-600 hover:underline">
        ← Cartas contempladas
      </Link>
      <div className="flex flex-wrap gap-2">
        {carta.ativo ? (
          <form action={toggleOff}>
            <Button type="submit" variant="outline" size="sm">
              Inativar
            </Button>
          </form>
        ) : (
          <form action={toggleOn}>
            <Button type="submit" variant="outline" size="sm">
              Reativar
            </Button>
          </form>
        )}
        {canDeleteRecords(usuario?.perfil) ? (
          <form action={del}>
            <Button type="submit" variant="danger" size="sm">
              Excluir (Master)
            </Button>
          </form>
        ) : null}
      </div>
      <h1 className="text-2xl font-bold">
        Carta — {carta.administradora ?? "Sem administradora"}
      </h1>
      <form action={update}>
        <CartaFormFields initial={carta as Record<string, unknown>} />
      </form>
      {carta.texto_original ? (
        <section className="rounded-xl border bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-2 font-semibold">Texto original (WhatsApp)</h2>
          <pre className="whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">{carta.texto_original}</pre>
        </section>
      ) : null}
    </div>
  );
}
