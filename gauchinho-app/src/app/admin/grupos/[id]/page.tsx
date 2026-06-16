import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteGrupoAction,
  duplicateGrupoAction,
  fetchGrupoWithCotas,
  fetchModalidadesByGrupoId,
  toggleGrupoAtivoAction,
  updateGrupoAction,
} from "../actions";
import { GrupoFormFields } from "@/components/admin/grupo-form-fields";
import { GrupoCotasAdmin } from "@/components/admin/grupo-cotas-admin";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canDeleteRecords } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/form-primitives";

export default async function GrupoEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const usuario = await getUsuarioNegocio();
  let data;
  try {
    data = await fetchGrupoWithCotas(id);
  } catch {
    notFound();
  }
  const modalidades = await fetchModalidadesByGrupoId(id);
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
      {sp.error ? (
        <p className="rounded-lg border border-red-600/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300">
          {decodeURIComponent(sp.error)}
        </p>
      ) : null}
      {sp.saved === "1" ? (
        <p className="rounded-lg border border-emerald-600/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          Grupo salvo com sucesso.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <form action={dup}>
          <Button type="submit" variant="outline" size="sm" className="border-zinc-600 bg-zinc-900 text-zinc-100">
            Duplicar
          </Button>
        </form>
        {data.grupo.ativo ? (
          <form action={toggleOff}>
            <Button type="submit" variant="outline" size="sm" className="border-zinc-600 bg-zinc-900 text-zinc-100">
              Inativar
            </Button>
          </form>
        ) : (
          <form action={toggleOn}>
            <Button type="submit" variant="outline" size="sm" className="border-zinc-600 bg-zinc-900 text-zinc-100">
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
        <GrupoFormFields
          initial={data.grupo as Record<string, unknown>}
          modalidadesInitial={modalidades}
        />
      </form>
      <GrupoCotasAdmin
        grupoId={id}
        cotas={data.cotas}
        canHardDelete={canDeleteRecords(usuario?.perfil)}
      />
    </div>
  );
}
