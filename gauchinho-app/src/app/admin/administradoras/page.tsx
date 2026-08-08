import Link from "next/link";
import { redirect } from "next/navigation";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { formatDate } from "@/lib/utils/format";
import { Button, Input, Select } from "@/components/ui/form-primitives";
import {
  fetchAdministradorasGlobaisList,
  setAdministradoraStatusAction,
} from "./actions";

export default async function AdministradorasAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const superadmin = await isPlatformSuperadmin();
  if (!superadmin) redirect("/admin");

  const sp = await searchParams;
  const list = await fetchAdministradorasGlobaisList({ q: sp.q, status: sp.status });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Catálogo de Administradoras</h1>
          <p className="text-sm text-zinc-500">
            Administradoras globais da plataforma (ex.: Racon). Empresas/franqueadas são tenants
            distintos — concessões serão geridas na E4.
          </p>
        </div>
        <Link href="/admin/administradoras/nova">
          <Button>Nova administradora</Button>
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Busca</label>
          <Input name="q" defaultValue={sp.q ?? ""} placeholder="nome, slug, CNPJ" className="w-56" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Status</label>
          <Select name="status" defaultValue={sp.status ?? ""}>
            <option value="">Todos</option>
            <option value="ATIVA">ATIVA</option>
            <option value="INATIVA">INATIVA</option>
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Fantasia</th>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2">CNPJ</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Empresas/franquias</th>
              <th className="px-3 py-2">Atualização</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-zinc-500">
                  Nenhuma administradora encontrada.
                </td>
              </tr>
            ) : (
              list.map((row) => {
                const nextStatus = row.status === "ATIVA" ? "INATIVA" : "ATIVA";
                const toggle = setAdministradoraStatusAction.bind(null, row.id, nextStatus);
                return (
                  <tr key={row.id} className="border-b dark:border-zinc-800">
                    <td className="px-3 py-2 font-medium">{row.nome}</td>
                    <td className="px-3 py-2">{row.nome_fantasia ?? "—"}</td>
                    <td className="px-3 py-2 text-zinc-500">{row.slug}</td>
                    <td className="px-3 py-2">{row.cnpj ?? "—"}</td>
                    <td className="px-3 py-2">{row.status}</td>
                    <td className="px-3 py-2">{row.empresas_vinculadas_count}</td>
                    <td className="px-3 py-2">{formatDate(row.updated_at)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Link
                        href={`/admin/administradoras/${row.id}`}
                        className="text-amber-600 hover:underline"
                      >
                        Editar
                      </Link>
                      <form action={toggle} className="ml-2 inline">
                        <Button type="submit" size="sm" variant="outline">
                          {row.status === "ATIVA" ? "Inativar" : "Reativar"}
                        </Button>
                      </form>
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
