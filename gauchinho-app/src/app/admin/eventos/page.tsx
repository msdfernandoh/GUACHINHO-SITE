import { redirect } from "next/navigation";
import Link from "next/link";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageImobiliarias } from "@/lib/auth/permissions";
import { fetchEventosAdminListSafe } from "./actions";
import { fetchEventosQrVinculosMap } from "@/lib/eventos-sorteio/qr-unico";
import { Button } from "@/components/ui/form-primitives";
import { formatDateTime } from "@/lib/utils/format";
import { EventoAcoesMenu } from "@/components/admin/eventos/evento-acoes-menu";

export default async function EventosAdminPage() {
  const u = await getUsuarioNegocio();
  if (!canManageImobiliarias(u?.perfil)) redirect("/admin");

  const [result, vinculosMap] = await Promise.all([
    fetchEventosAdminListSafe(),
    fetchEventosQrVinculosMap(),
  ]);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Eventos</h1>
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
          <p className="font-semibold">Não foi possível carregar os eventos</p>
          <p className="mt-2 whitespace-pre-wrap opacity-90">{result.message}</p>
        </div>
      </div>
    );
  }

  const list = result.list;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Eventos</h1>
          <p className="text-sm text-zinc-500">Encontros comerciais, inscrições e participantes</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/eventos/nps">
            <Button variant="outline">Dashboard NPS</Button>
          </Link>
          <Link href="/admin/eventos/novo">
            <Button>Novo evento</Button>
          </Link>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
            <tr>
              <th className="px-3 py-2.5">Nome</th>
              <th className="px-3 py-2.5">Check-in</th>
              <th className="px-3 py-2.5">Data</th>
              <th className="px-3 py-2.5">Publicado</th>
              <th className="px-3 py-2.5 text-right">Ações do Evento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {list.map((row) => (
              <tr key={row.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition">
                <td className="px-3 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                  <div className="font-semibold">{row.nome}</div>
                  <div className="text-xs text-zinc-400">/{row.slug}</div>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      row.checkin_interativo_ativo
                        ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        row.checkin_interativo_ativo ? "bg-emerald-500" : "bg-zinc-400"
                      }`}
                    />
                    {row.checkin_interativo_ativo ? "Interativo" : "Tradicional"}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                  {row.data_evento ? formatDateTime(row.data_evento, null) : "—"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      row.publicado
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {row.publicado ? "Publicado" : "Rascunho"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex justify-end">
                    <EventoAcoesMenu
                      evento={row}
                      qrVinculo={vinculosMap[row.id] ?? null}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
