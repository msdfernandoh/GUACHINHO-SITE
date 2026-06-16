import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageConteudo } from "@/lib/auth/permissions";
import { fetchAdminDicas } from "../actions";
import { Button } from "@/components/ui/form-primitives";

export default async function AdminDicasPage() {
  const u = await getUsuarioNegocio();
  if (!canManageConteudo(u?.perfil)) redirect("/admin");
  const list = await fetchAdminDicas();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin/conteudo" className="text-sm text-amber-600 hover:underline">
            ← Conteúdo
          </Link>
          <h1 className="text-2xl font-bold">Dicas do Tchê</h1>
        </div>
        <Link href="/admin/conteudo/dicas/novo">
          <Button>Nova dica</Button>
        </Link>
      </div>
      <ListTable
        rows={list.map((r) => ({
          id: r.id,
          cols: [r.titulo, r.categoria ?? "—", r.publicado ? "Sim" : "Não", r.destaque ? "Sim" : "Não", String(r.ordem)],
        }))}
        headers={["Título", "Categoria", "Publicado", "Destaque", "Ordem"]}
        editPrefix="/admin/conteudo/dicas"
      />
    </div>
  );
}

function ListTable({
  headers,
  rows,
  editPrefix,
}: {
  headers: string[];
  rows: { id: string; cols: string[] }[];
  editPrefix: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="min-w-full text-sm">
        <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2">
                {h}
              </th>
            ))}
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b dark:border-zinc-800">
              {row.cols.map((c, i) => (
                <td key={i} className="px-3 py-2">
                  {c}
                </td>
              ))}
              <td className="px-3 py-2">
                <Link href={`${editPrefix}/${row.id}`} className="text-amber-600 hover:underline">
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
