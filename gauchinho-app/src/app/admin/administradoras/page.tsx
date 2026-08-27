import Link from "next/link";
import { redirect } from "next/navigation";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { listAdministradorasAutorizadasForEmpresa } from "@/lib/administradoras/service";

export default async function AdministradorasAdminPage() {
  const superadmin = await isPlatformSuperadmin();
  if (!superadmin) redirect("/admin");
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) redirect("/admin");
  const list = await listAdministradorasAutorizadasForEmpresa(empresaAtiva.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Administradoras autorizadas</h1>
          <p className="text-sm text-zinc-500">
            Somente concessões ativas para {empresaAtiva.nome_fantasia}. O catálogo global permanece restrito ao SaaS.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Fantasia</th>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Concessão</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-zinc-500">
                  Nenhuma administradora autorizada para esta franquia.
                </td>
              </tr>
            ) : (
              list.map((row) => {
                return (
                  <tr key={row.id} className="border-b dark:border-zinc-800">
                    <td className="px-3 py-2 font-medium">{row.nome}</td>
                    <td className="px-3 py-2">{row.nome_fantasia ?? "—"}</td>
                    <td className="px-3 py-2 text-zinc-500">{row.slug}</td>
                    <td className="px-3 py-2">{row.status}</td>
                    <td className="px-3 py-2">{row.concessao.status}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Link
                        href={`/admin/administradoras/${row.id}`}
                        className="text-amber-600 hover:underline"
                      >
                        Visualizar
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
