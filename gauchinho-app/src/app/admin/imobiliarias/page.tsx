import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageImobiliarias } from "@/lib/auth/permissions";
import { fetchImobiliariasList, toggleImobiliariaAtivoAction } from "./actions";
import { Button } from "@/components/ui/form-primitives";
import { formatDate } from "@/lib/utils/format";

export default async function ImobiliariasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ativo?: string }>;
}) {
  const u = await getUsuarioNegocio();
  if (!canManageImobiliarias(u?.perfil)) redirect("/admin");

  const sp = await searchParams;
  const list = await fetchImobiliariasList({ q: sp.q, ativo: sp.ativo });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Imobiliárias</h1>
          <p className="text-sm text-zinc-500">Parceiros e login imobiliária</p>
        </div>
        <Link href="/admin/imobiliarias/novo">
          <Button>Nova imobiliária</Button>
        </Link>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Cidade</th>
              <th className="px-3 py-2">Imóveis</th>
              <th className="px-3 py-2">Ativa</th>
              <th className="px-3 py-2">Home</th>
              <th className="px-3 py-2">Desde</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((row) => {
              const count = Array.isArray(row.imoveis)
                ? (row.imoveis[0] as { count?: number })?.count ?? 0
                : 0;
              const toggle = toggleImobiliariaAtivoAction.bind(null, row.id, !row.ativo);
              return (
                <tr key={row.id} className="border-b dark:border-zinc-800">
                  <td className="px-3 py-2 font-medium">{row.nome}</td>
                  <td className="px-3 py-2">{row.cidade ?? "—"}</td>
                  <td className="px-3 py-2">{count}</td>
                  <td className="px-3 py-2">{row.ativo ? "Sim" : "Não"}</td>
                  <td className="px-3 py-2">{row.exibir_home ? "Sim" : "Não"}</td>
                  <td className="px-3 py-2">{formatDate(row.created_at)}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/imobiliarias/${row.id}`} className="text-amber-600 hover:underline">
                      Editar
                    </Link>
                    <form action={toggle} className="ml-2 inline">
                      <Button type="submit" size="sm" variant="outline">
                        {row.ativo ? "Inativar" : "Ativar"}
                      </Button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
