import Link from "next/link";
import { fetchPropostasList } from "./actions";
import { Button, Input, Label } from "@/components/ui/form-primitives";
import { formatCurrency, formatDate } from "@/lib/utils/format";

export default async function PropostasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const rows = await fetchPropostasList(sp.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Propostas</h1>
          <p className="text-sm text-zinc-500">PDF premium na Fase 3</p>
        </div>
        <Link href="/admin/propostas/nova">
          <Button>Nova proposta</Button>
        </Link>
      </div>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <Label>Status</Label>
          <Input name="status" defaultValue={sp.status ?? ""} placeholder="Gerada, Enviada…" />
        </div>
        <Button type="submit" size="sm">
          Filtrar
        </Button>
      </form>
      <div className="overflow-x-auto rounded-xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Crédito</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b dark:border-zinc-800">
                <td className="px-3 py-2">{formatDate(p.created_at)}</td>
                <td className="px-3 py-2">{p.nome_cliente ?? "—"}</td>
                <td className="px-3 py-2">{p.tipo_proposta ?? "—"}</td>
                <td className="px-3 py-2">{formatCurrency(Number(p.valor_credito))}</td>
                <td className="px-3 py-2">{p.status}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/propostas/${p.id}`} className="text-amber-600 hover:underline">
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
