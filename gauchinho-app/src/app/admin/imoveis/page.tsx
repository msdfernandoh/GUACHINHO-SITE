import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { isImobiliaria, isStaff } from "@/lib/auth/permissions";
import { fetchImoveisList } from "./actions";
import { fetchImobiliariasList } from "../imobiliarias/actions";
import { Button } from "@/components/ui/form-primitives";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { IMOVEL_TIPOS } from "@/lib/imoveis/types";

export default async function ImoveisAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ imobiliaria_id?: string; status?: string }>;
}) {
  const u = await getUsuarioNegocio();
  if (!u || (!isStaff(u.perfil) && !isImobiliaria(u.perfil))) redirect("/login");

  const sp = await searchParams;
  const list = await fetchImoveisList({
    imobiliaria_id: sp.imobiliaria_id,
    status: sp.status,
  });

  const imobiliarias =
    u.perfil === "master" ? await fetchImobiliariasList({ ativo: "sim" }) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{isImobiliaria(u.perfil) ? "Meus imóveis" : "Imóveis"}</h1>
        </div>
        <Link href="/admin/imoveis/novo">
          <Button>Novo imóvel</Button>
        </Link>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
            <tr>
              <th className="px-3 py-2">Título</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Cidade</th>
              <th className="px-3 py-2">Valor</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Atualizado</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((row) => {
              const tipo = IMOVEL_TIPOS.find((t) => t.value === row.tipo_imovel)?.label ?? row.tipo_imovel;
              const imob = row.imobiliarias as { nome?: string } | null;
              return (
                <tr key={row.id} className="border-b dark:border-zinc-800">
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.titulo}</div>
                    {imob?.nome && <div className="text-xs text-zinc-500">{imob.nome}</div>}
                  </td>
                  <td className="px-3 py-2">{tipo}</td>
                  <td className="px-3 py-2">{row.cidade ?? "—"}</td>
                  <td className="px-3 py-2">
                    {row.exibir_valor_publico && row.valor != null
                      ? formatCurrency(Number(row.valor))
                      : "Sob consulta"}
                  </td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">{formatDate(row.updated_at)}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/imoveis/${row.id}`} className="text-amber-600 hover:underline">
                      Editar
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {imobiliarias.length > 0 && (
        <p className="text-xs text-zinc-500">Filtre por imobiliária via query ?imobiliaria_id=</p>
      )}
    </div>
  );
}
