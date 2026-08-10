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
import { GrupoEmpresaConfigSection } from "@/components/admin/grupo-empresa-config-section";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { canDeleteRecords } from "@/lib/auth/permissions";
import { getEmpresaGrupoConfig } from "@/lib/grupos/empresa-grupos-config";
import type { GrupoConsorcio } from "@/lib/types";
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
  const isSuper = await isPlatformSuperadmin();

  let data;
  try {
    data = await fetchGrupoWithCotas(id);
  } catch {
    notFound();
  }

  const modalidades = await fetchModalidadesByGrupoId(id);
  const empresaConfig = usuario?.empresa_id
    ? await getEmpresaGrupoConfig(usuario.empresa_id, id)
    : null;

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

      {isSuper ? (
        <div className="flex flex-wrap gap-2">
          <form action={dup}>
            <Button type="submit" variant="outline" size="sm" className="border-zinc-600 bg-zinc-900 text-zinc-100">
              Duplicar Grupo Global
            </Button>
          </form>
          {data.grupo.ativo ? (
            <form action={toggleOff}>
              <Button type="submit" variant="outline" size="sm" className="border-zinc-600 bg-zinc-900 text-zinc-100">
                Inativar Globalmente
              </Button>
            </form>
          ) : (
            <form action={toggleOn}>
              <Button type="submit" variant="outline" size="sm" className="border-zinc-600 bg-zinc-900 text-zinc-100">
                Reativar Globalmente
              </Button>
            </form>
          )}
          {canDeleteRecords(usuario?.perfil) ? (
            <form action={del}>
              <Button type="submit" variant="danger" size="sm">
                Excluir (Superadmin)
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}

      <h1 className="text-2xl font-bold">Grupo {data.grupo.codigo_grupo}</h1>

      {usuario?.empresa_id ? (
        <GrupoEmpresaConfigSection
          empresaId={usuario.empresa_id}
          grupoId={id}
          codigoGrupo={data.grupo.codigo_grupo}
          config={empresaConfig}
        />
      ) : null}

      {isSuper ? (
        <form id="grupo-form" action={update} className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900/90 space-y-6">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Estrutura Oficial do Catálogo Global (Superadmin)
            </h2>
            <GrupoFormFields
              formId="grupo-form"
              initial={data.grupo as Record<string, unknown>}
              modalidadesInitial={modalidades}
            />
          </div>
        </form>
      ) : null}

      <GrupoCotasAdmin
        grupoId={id}
        grupo={data.grupo as GrupoConsorcio}
        cotas={data.cotas}
        canHardDelete={isSuper && canDeleteRecords(usuario?.perfil)}
      />
    </div>
  );
}
