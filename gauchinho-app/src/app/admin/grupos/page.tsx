import Link from "next/link";
import { fetchGruposList } from "./actions";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";
import { MODALIDADES_GRUPO } from "@/lib/types";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canEditSettings } from "@/lib/auth/permissions";
import { PopularGruposTesteButton } from "@/components/admin/popular-grupos-teste-button";

export default async function GruposAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ modalidade?: string; status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const grupos = await fetchGruposList(sp);
  const usuario = await getUsuarioNegocio();
  const showPopular = canEditSettings(usuario?.perfil);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Grupos</h1>
          <p className="text-sm text-zinc-500">Consórcio — grupos e cotas</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {showPopular ? <PopularGruposTesteButton /> : null}
          <Link href="/admin/grupos/novo">
            <Button>Novo grupo</Button>
          </Link>
        </div>
      </div>
      <form method="get" className="flex flex-wrap gap-3 rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <Label>Modalidade</Label>
          <Select name="modalidade" defaultValue={sp.modalidade ?? ""}>
            <option value="">Todas</option>
            {MODALIDADES_GRUPO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Input name="status" defaultValue={sp.status ?? ""} />
        </div>
        <div>
          <Label>Código</Label>
          <Input name="q" defaultValue={sp.q ?? ""} />
        </div>
        <Button type="submit" size="sm" className="self-end">
          Filtrar
        </Button>
      </form>
      <div className="overflow-x-auto rounded-xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Modalidade</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Cotas</th>
              <th className="px-3 py-2">Ativo</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => {
              const count = Array.isArray(g.grupos_cotas)
                ? g.grupos_cotas[0]?.count
                : (g.grupos_cotas as { count: number } | undefined)?.count;
              return (
                <tr key={g.id} className="border-b dark:border-zinc-800">
                  <td className="px-3 py-2 font-medium">{g.codigo_grupo}</td>
                  <td className="px-3 py-2">{g.modalidade}</td>
                  <td className="px-3 py-2">{g.status}</td>
                  <td className="px-3 py-2">{count ?? 0}</td>
                  <td className="px-3 py-2">{g.ativo ? "Sim" : "Não"}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/grupos/${g.id}`} className="text-amber-600 hover:underline">
                      Editar
                    </Link>
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
