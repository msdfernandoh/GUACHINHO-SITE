import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageImobiliarias } from "@/lib/auth/permissions";
import { fetchEventosAdminList } from "./actions";
import { Button } from "@/components/ui/form-primitives";
import { formatDateTime } from "@/lib/utils/format";

export default async function EventosAdminPage() {
  const u = await getUsuarioNegocio();
  if (!canManageImobiliarias(u?.perfil)) redirect("/admin");

  const list = await fetchEventosAdminList();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Eventos</h1>
          <p className="text-sm text-zinc-500">Encontros comerciais, inscrições e participantes</p>
        </div>
        <Link href="/admin/eventos/novo">
          <Button>Novo evento</Button>
        </Link>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Publicado</th>
              <th className="px-3 py-2">Só link</th>
              <th className="px-3 py-2">Destaque</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((row) => (
              <tr key={row.id} className="border-b dark:border-zinc-800">
                <td className="px-3 py-2 font-medium">{row.nome}</td>
                <td className="px-3 py-2">{row.data_evento ? formatDateTime(row.data_evento, null) : "—"}</td>
                <td className="px-3 py-2">{row.publicado ? "Sim" : "Não"}</td>
                <td className="px-3 py-2">{row.somente_por_link ? "Sim" : "Não"}</td>
                <td className="px-3 py-2">{row.evento_destaque ? "Sim" : "—"}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/eventos/${row.id}`} className="text-amber-600 hover:underline">
                    Editar
                  </Link>
                  <Link href={`/admin/eventos/${row.id}/participantes`} className="ml-3 text-amber-600 hover:underline">
                    Participantes
                  </Link>
                  {row.publicado ? (
                    <Link href={`/eventos/${row.slug}`} className="ml-3 text-zinc-500 hover:underline" target="_blank">
                      Ver público
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
