import Link from "next/link";
import { redirect } from "next/navigation";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { fetchEmpresasList } from "./actions";

export default async function EmpresasAdminPage() {
  const superadmin = await isPlatformSuperadmin();
  if (!superadmin) redirect("/admin");

  const empresas = await fetchEmpresasList();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Empresas (Plataforma SaaS)</h1>
        <p className="text-sm text-zinc-500">
          Tenants da plataforma. A Gauchinho é a empresa 1; demais empresas são independentes.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
            <tr>
              <th className="px-3 py-2">Nome fantasia</th>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Ativa</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {empresas.map((row) => (
              <tr key={row.id} className="border-b dark:border-zinc-800">
                <td className="px-3 py-2 font-medium">{row.nome_fantasia}</td>
                <td className="px-3 py-2 text-zinc-500">{row.slug}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">{row.ativo ? "Sim" : "Não"}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/empresas/${row.id}`} className="text-amber-600 hover:underline">
                    Gerenciar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
