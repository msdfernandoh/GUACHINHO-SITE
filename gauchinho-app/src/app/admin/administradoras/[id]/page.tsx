import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { AdministradoraNotFoundError } from "@/lib/administradoras/errors";
import { AdministradoraForm } from "@/components/admin/administradora-form";
import { Button } from "@/components/ui/form-primitives";
import {
  fetchAdministradoraGlobal,
  fetchEmpresasFranqueadasDaAdministradora,
  setAdministradoraStatusAction,
  updateAdministradoraAction,
} from "../actions";

export default async function AdministradoraDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const superadmin = await isPlatformSuperadmin();
  if (!superadmin) redirect("/admin");

  const { id } = await params;

  let administradora;
  try {
    administradora = await fetchAdministradoraGlobal(id);
  } catch (err) {
    if (err instanceof AdministradoraNotFoundError) notFound();
    throw err;
  }

  const empresasFranqueadas = await fetchEmpresasFranqueadasDaAdministradora(id);
  const update = updateAdministradoraAction.bind(null, id);
  const nextStatus = administradora.status === "ATIVA" ? "INATIVA" : "ATIVA";
  const toggleStatus = setAdministradoraStatusAction.bind(null, id, nextStatus);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/administradoras" className="text-sm text-amber-600 hover:underline">
            ← Voltar ao catálogo
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{administradora.nome}</h1>
          <p className="text-sm text-zinc-500">
            Administradora global · slug <code className="text-xs">{administradora.slug}</code> ·{" "}
            {administradora.status}
          </p>
        </div>
        <form action={toggleStatus}>
          <Button type="submit" variant="outline">
            {administradora.status === "ATIVA" ? "Inativar" : "Reativar"}
          </Button>
        </form>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-zinc-600 dark:text-zinc-300">
        <p className="font-medium text-amber-800 dark:text-amber-300">Sobre inativação</p>
        <p className="mt-1">
          Inativar administradora impede novos usos quando os módulos passarem a respeitar o
          catálogo; histórico permanece preservado. Não apaga concessões, grupos nem registros
          comerciais.
        </p>
      </div>

      <AdministradoraForm action={update} administradora={administradora} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Empresas / franqueadas vinculadas</h2>
        <p className="text-sm text-zinc-500">
          Estas são empresas SaaS autorizadas a operar esta administradora —{" "}
          <strong className="font-medium">não</strong> são administradoras. Gestão de concessões:
          E4.
        </p>
        <div className="overflow-x-auto rounded-xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
              <tr>
                <th className="px-3 py-2">Empresa / franqueada</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Status do vínculo</th>
              </tr>
            </thead>
            <tbody>
              {empresasFranqueadas.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-zinc-500">
                    Nenhuma empresa/franqueada vinculada.
                  </td>
                </tr>
              ) : (
                empresasFranqueadas.map((e) => (
                  <tr key={e.empresa_id} className="border-b dark:border-zinc-800">
                    <td className="px-3 py-2 font-medium">{e.nome_fantasia}</td>
                    <td className="px-3 py-2 text-zinc-500">{e.slug}</td>
                    <td className="px-3 py-2">{e.status_vinculo}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
