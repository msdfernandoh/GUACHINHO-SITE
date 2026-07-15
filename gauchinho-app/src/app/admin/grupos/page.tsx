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
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Grupos</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Consórcio — grupos e cotas</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {showPopular ? <PopularGruposTesteButton /> : null}
          <Link
            href="/admin/grupos/sorteios"
            className="text-sm text-amber-600 hover:underline dark:text-amber-400 dark:hover:text-amber-300"
          >
            Sorteios Loteria Federal
          </Link>
          <Link href="/admin/grupos/novo">
            <Button>Novo grupo</Button>
          </Link>
        </div>
      </div>
      <form
        method="get"
        className="flex flex-wrap gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/90"
      >
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
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900/90">
        <table className="min-w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Modalidade</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Cotas (valores)</th>
              <th className="px-3 py-2">Participantes</th>
              <th className="px-3 py-2">Ativo</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="text-zinc-800 dark:text-zinc-200">
            {grupos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-zinc-500 dark:text-zinc-400">
                  Nenhum grupo encontrado. Ajuste os filtros ou cadastre um novo grupo.
                </td>
              </tr>
            ) : null}
            {grupos.map((g) => {
              const count = Array.isArray(g.grupos_cotas)
                ? g.grupos_cotas[0]?.count
                : (g.grupos_cotas as { count: number } | undefined)?.count;
              return (
                <tr
                  key={g.id}
                  className="border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
                >
                  <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                    {g.codigo_grupo}
                  </td>
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-200">{g.modalidade}</td>
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-200">{g.status}</td>
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-200">{count ?? 0}</td>
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-200">
                    {g.quantidade_cotas_sorteio != null && g.quantidade_cotas_sorteio > 0
                      ? g.quantidade_cotas_sorteio
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-200">
                    {g.ativo ? "Sim" : "Não"}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/grupos/${g.id}`}
                      className="text-amber-600 hover:underline dark:text-amber-400"
                    >
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
