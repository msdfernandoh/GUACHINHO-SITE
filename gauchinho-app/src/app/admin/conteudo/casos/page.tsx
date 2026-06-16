import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageConteudo } from "@/lib/auth/permissions";
import { fetchAdminCasos } from "../actions";
import { Button } from "@/components/ui/form-primitives";

export default async function AdminCasosPage() {
  const u = await getUsuarioNegocio();
  if (!canManageConteudo(u?.perfil)) redirect("/admin");

  const list = await fetchAdminCasos();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin/conteudo" className="text-sm text-amber-600 hover:underline">
            ← Conteúdo
          </Link>
          <h1 className="text-2xl font-bold">Casos de sucesso</h1>
        </div>
        <Link href="/admin/conteudo/casos/novo">
          <Button>Novo caso</Button>
        </Link>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
            <tr>
              <th className="px-3 py-2">Título</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2">Publicado</th>
              <th className="px-3 py-2">Destaque</th>
              <th className="px-3 py-2">Ordem</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((row) => (
              <tr key={row.id} className="border-b dark:border-zinc-800">
                <td className="px-3 py-2 font-medium">{row.titulo}</td>
                <td className="px-3 py-2">{row.categoria ?? "—"}</td>
                <td className="px-3 py-2">{row.publicado ? "Sim" : "Não"}</td>
                <td className="px-3 py-2">{row.destaque ? "Sim" : "Não"}</td>
                <td className="px-3 py-2">{row.ordem}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/conteudo/casos/${row.id}`} className="text-amber-600 hover:underline">
                    Editar
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
