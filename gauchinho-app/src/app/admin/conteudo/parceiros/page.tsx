import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageConteudo } from "@/lib/auth/permissions";
import { fetchAdminParceiros } from "../actions";
import { Button } from "@/components/ui/form-primitives";

export default async function AdminParceirosPage() {
  const u = await getUsuarioNegocio();
  if (!canManageConteudo(u?.perfil)) redirect("/admin");
  const list = await fetchAdminParceiros();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin/conteudo" className="text-sm text-amber-600 hover:underline">
            ← Conteúdo
          </Link>
          <h1 className="text-2xl font-bold">Parceiros</h1>
        </div>
        <Link href="/admin/conteudo/parceiros/novo">
          <Button>Novo parceiro</Button>
        </Link>
      </div>
      <table className="min-w-full rounded-xl border text-sm dark:border-zinc-800">
        <thead className="bg-zinc-50 text-left text-xs uppercase dark:bg-zinc-800/50">
          <tr>
            <th className="px-3 py-2">Nome</th>
            <th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2">Publicado</th>
            <th className="px-3 py-2">Destaque</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id} className="border-t dark:border-zinc-800">
              <td className="px-3 py-2">{r.nome}</td>
              <td className="px-3 py-2">{r.tipo ?? "—"}</td>
              <td className="px-3 py-2">{r.publicado ? "Sim" : "Não"}</td>
              <td className="px-3 py-2">{r.destaque ? "Sim" : "Não"}</td>
              <td className="px-3 py-2">
                <Link href={`/admin/conteudo/parceiros/${r.id}`} className="text-amber-600 hover:underline">
                  Editar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
