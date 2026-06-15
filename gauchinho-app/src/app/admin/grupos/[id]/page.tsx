import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteGrupoAction,
  duplicateGrupoAction,
  fetchGrupoWithCotas,
  toggleGrupoAtivoAction,
  updateGrupoAction,
} from "../actions";
import { GrupoFormFields } from "@/components/admin/grupo-form-fields";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canDeleteRecords } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/form-primitives";
import { formatCurrency } from "@/lib/utils/format";

export default async function GrupoEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await getUsuarioNegocio();
  let data;
  try {
    data = await fetchGrupoWithCotas(id);
  } catch {
    notFound();
  }
  const update = updateGrupoAction.bind(null, id);
  const dup = duplicateGrupoAction.bind(null, id);
  const del = deleteGrupoAction.bind(null, id);
  const toggleOff = toggleGrupoAtivoAction.bind(null, id, false);
  const toggleOn = toggleGrupoAtivoAction.bind(null, id, true);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/grupos" className="text-sm text-amber-600 hover:underline">
        ← Grupos
      </Link>
      <div className="flex flex-wrap gap-2">
        <form action={dup}>
          <Button type="submit" variant="outline" size="sm">
            Duplicar
          </Button>
        </form>
        {data.grupo.ativo ? (
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
      <h1 className="text-2xl font-bold">Grupo {data.grupo.codigo_grupo}</h1>
      <form action={update} className="space-y-6">
        <GrupoFormFields initial={data.grupo as Record<string, unknown>} />
      </form>
      <section className="rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 font-semibold">Cotas cadastradas</h2>
        <ul className="space-y-1 text-sm">
          {data.cotas.map((c) => (
            <li key={c.id}>
              {formatCurrency(Number(c.valor_credito))} — {c.status}
              {c.valor_parcela ? ` · parcela ${formatCurrency(Number(c.valor_parcela))}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
