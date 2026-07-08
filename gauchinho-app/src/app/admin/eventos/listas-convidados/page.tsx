import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageLeads } from "@/lib/auth/permissions";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";
import { fetchEventosOptionsForListas, fetchListasConvidadosResumo } from "./actions";

export default async function ListasConvidadosPage({
  searchParams,
}: {
  searchParams: Promise<{ evento_id?: string; consultor?: string }>;
}) {
  const u = await getUsuarioNegocio();
  if (!canManageLeads(u?.perfil)) redirect("/admin");

  const sp = await searchParams;
  const [result, eventos] = await Promise.all([
    fetchListasConvidadosResumo({
      evento_id: sp.evento_id,
      consultor: sp.consultor,
    }),
    fetchEventosOptionsForListas(),
  ]);

  if ("migrationMissing" in result && result.migrationMissing) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Listas de convidados</h1>
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm">
          Execute a migration <code className="text-amber-200">020_eventos_listas_convidados.sql</code> no Supabase.
        </div>
      </div>
    );
  }

  const listas = Array.isArray(result) ? result : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin/eventos" className="text-sm text-amber-600 hover:underline">
            ← Eventos
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Listas de convidados</h1>
          <p className="text-sm text-zinc-500">
            Controle de convites, confirmações, presença e resultados por consultor
          </p>
        </div>
        <Link href="/admin/eventos/listas-convidados/nova">
          <Button>Nova lista</Button>
        </Link>
      </div>

      <form method="get" className="flex flex-wrap gap-3 rounded-xl border p-4 dark:border-zinc-800">
        <div>
          <Label>Evento</Label>
          <Select name="evento_id" defaultValue={sp.evento_id ?? ""} className="mt-1 min-w-[220px]">
            <option value="">Todos</option>
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.nome}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Consultor</Label>
          <Input name="consultor" defaultValue={sp.consultor ?? ""} className="mt-1" />
        </div>
        <div className="flex items-end">
          <Button type="submit">Filtrar</Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left text-xs uppercase dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Evento</th>
              <th className="px-3 py-2">Consultor</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Confirmados</th>
              <th className="px-3 py-2">Presentes</th>
              <th className="px-3 py-2">Cancelados</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {listas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                  Nenhuma lista ainda.{" "}
                  <Link href="/admin/eventos/listas-convidados/nova" className="text-amber-600 hover:underline">
                    Criar primeira lista
                  </Link>
                </td>
              </tr>
            ) : (
              listas.map((row) => (
                <tr key={row.id} className="border-b dark:border-zinc-800">
                  <td className="px-3 py-2 font-medium">{row.evento_nome}</td>
                  <td className="px-3 py-2">{row.consultor_nome}</td>
                  <td className="px-3 py-2 tabular-nums">{row.total}</td>
                  <td className="px-3 py-2 tabular-nums">{row.confirmados}</td>
                  <td className="px-3 py-2 tabular-nums">{row.presentes}</td>
                  <td className="px-3 py-2 tabular-nums">{row.cancelados}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/eventos/listas-convidados/${row.id}`} className="text-amber-600 hover:underline">
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
