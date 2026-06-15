import Link from "next/link";
import { fetchCartasList } from "./actions";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";
import { CARTA_STATUS, CARTA_STATUS_LABELS, CARTA_TIPOS } from "@/lib/cartas/types";
import { formatCurrency } from "@/lib/utils/format";
import {
  quickCartaStatusFormAction,
  toggleCartaAtivoFormAction,
  toggleCartaDestaqueFormAction,
} from "./actions";

export default async function CartasContempladasAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: string;
    status?: string;
    q?: string;
    ativo?: string;
  }>;
}) {
  const sp = await searchParams;
  const cartas = await fetchCartasList(sp);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cartas contempladas</h1>
          <p className="text-sm text-zinc-500">Cadastro, destaque e status comercial</p>
        </div>
        <Link href="/admin/cartas-contempladas/novo">
          <Button>Nova carta</Button>
        </Link>
      </div>

      <form method="get" className="flex flex-wrap gap-3 rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <Label>Tipo</Label>
          <Select name="tipo" defaultValue={sp.tipo ?? ""}>
            <option value="">Todos</option>
            {CARTA_TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select name="status" defaultValue={sp.status ?? ""}>
            <option value="">Todos</option>
            {CARTA_STATUS.map((s) => (
              <option key={s} value={s}>
                {CARTA_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Ativo</Label>
          <Select name="ativo" defaultValue={sp.ativo ?? ""}>
            <option value="">Todos</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </Select>
        </div>
        <div>
          <Label>Administradora</Label>
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
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Administradora</th>
              <th className="px-3 py-2">Crédito</th>
              <th className="px-3 py-2">Entrada</th>
              <th className="px-3 py-2">Parcela</th>
              <th className="px-3 py-2">Saldo</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Destaque</th>
              <th className="px-3 py-2">Ativo</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {cartas.map((c) => (
              <tr key={c.id} className="border-b dark:border-zinc-800">
                <td className="px-3 py-2">
                  {c.tipo_carta === "automovel" ? "Automóvel" : "Imóvel"}
                </td>
                <td className="px-3 py-2">{c.administradora ?? "—"}</td>
                <td className="px-3 py-2">{formatCurrency(Number(c.credito))}</td>
                <td className="px-3 py-2">{formatCurrency(Number(c.entrada))}</td>
                <td className="px-3 py-2">{formatCurrency(Number(c.valor_parcela))}</td>
                <td className="px-3 py-2">{formatCurrency(Number(c.saldo_devedor))}</td>
                <td className="px-3 py-2">
                  <form action={quickCartaStatusFormAction} className="flex items-center gap-1">
                    <input type="hidden" name="carta_id" value={c.id} />
                    <Select name="status" defaultValue={c.status} className="min-w-[9rem] text-xs">
                      {CARTA_STATUS.map((s) => (
                        <option key={s} value={s}>
                          {CARTA_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </Select>
                    <Button type="submit" size="sm" variant="outline">
                      OK
                    </Button>
                  </form>
                </td>
                <td className="px-3 py-2">
                  <form action={toggleCartaDestaqueFormAction}>
                    <input type="hidden" name="carta_id" value={c.id} />
                    <input type="hidden" name="destaque" value={c.destaque ? "false" : "true"} />
                    <Button type="submit" size="sm" variant="outline">
                      {c.destaque ? "Sim" : "Não"}
                    </Button>
                  </form>
                </td>
                <td className="px-3 py-2">
                  <form action={toggleCartaAtivoFormAction}>
                    <input type="hidden" name="carta_id" value={c.id} />
                    <input type="hidden" name="ativo" value={c.ativo ? "false" : "true"} />
                    <Button type="submit" size="sm" variant="outline">
                      {c.ativo ? "Sim" : "Não"}
                    </Button>
                  </form>
                </td>
                <td className="px-3 py-2">
                  <Link href={`/admin/cartas-contempladas/${c.id}`} className="text-amber-600 hover:underline">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {cartas.length === 0 ? (
          <p className="p-6 text-center text-zinc-500">Nenhuma carta cadastrada.</p>
        ) : null}
      </div>
    </div>
  );
}
