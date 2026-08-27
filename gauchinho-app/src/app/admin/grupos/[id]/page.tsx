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
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { canDeleteRecords } from "@/lib/auth/permissions";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { getEmpresaGrupoConfig } from "@/lib/grupos/empresa-grupos-config";
import type { GrupoConsorcio } from "@/lib/types";
import { Button } from "@/components/ui/form-primitives";
import { createClient } from "@/lib/supabase/server";

export default async function GrupoEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { usuario, empresaAtiva, permissoes } = await getCurrentTenantContext();
  const isSuper = await isPlatformSuperadmin();

  let data;
  try {
    data = await fetchGrupoWithCotas(id);
  } catch {
    notFound();
  }

  const modalidades = await fetchModalidadesByGrupoId(id);
  const supabase = await createClient();
  const [{ data: tiposAdministradora }, { data: modalidadesComissao }] = await Promise.all([
    supabase.from("administradora_tipos").select("id,nome").eq("administradora_id", data.grupo.administradora_id).eq("ativo", true).order("nome"),
    supabase.from("administradora_modalidades_comissao").select("id,nome").eq("administradora_id", data.grupo.administradora_id).eq("ativo", true).order("nome"),
  ]);
  const empresaId = empresaAtiva?.id;
  const empresaConfig = empresaId
    ? await getEmpresaGrupoConfig(empresaId, id)
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

      {empresaId && permissoes.has("gerenciar_grupos") ? (
        <GrupoEmpresaConfigSection
          empresaId={empresaId}
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
              tiposAdministradora={tiposAdministradora ?? []}
              modalidadesComissao={modalidadesComissao ?? []}
            />
          </div>
        </form>
      ) : null}

      {isSuper ? (
        <GrupoCotasAdmin
          grupoId={id}
          grupo={data.grupo as GrupoConsorcio}
          cotas={data.cotas}
          canHardDelete={canDeleteRecords(usuario?.perfil)}
        />
      ) : (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900/90">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Produtos e regras oficiais (somente leitura)
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            O SaaS publica crédito, prazo, taxas e regras do grupo. O site aplica o motor de cálculo oficial
            e congela os valores aceitos na proposta; o ERP não recalcula nem altera essa condição.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr><th className="py-2">Crédito</th><th className="py-2">Status</th><th className="py-2">Uso</th></tr>
              </thead>
              <tbody>
                {data.cotas.map((cota) => (
                  <tr key={cota.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 font-medium">
                      {Number(cota.valor_credito).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="py-2">{cota.status}</td>
                    <td className="py-2 text-zinc-500">Cálculo realizado no site</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
