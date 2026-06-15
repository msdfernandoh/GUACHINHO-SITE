import Link from "next/link";
import { fetchLeadsList, fetchSrdOptions } from "./actions";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";
import { formatDate } from "@/lib/utils/format";

export default async function LeadsListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const filters = {
    periodo: sp.periodo,
    origem: sp.origem,
    status: sp.status,
    srd: sp.srd,
    retorno: sp.retorno,
    q: sp.q,
  };
  const [leads, srds] = await Promise.all([fetchLeadsList(filters), fetchSrdOptions()]);

  const qs = new URLSearchParams();
  Object.entries(sp).forEach(([k, v]) => v && qs.set(k, v));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-zinc-500">Gestão comercial e retornos</p>
        </div>
        <Link href="/admin/leads/novo">
          <Button>Novo lead manual</Button>
        </Link>
      </div>

      <form
        method="get"
        action="/admin/leads"
        className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 md:grid-cols-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div>
          <Label>Período</Label>
          <Select name="periodo" defaultValue={sp.periodo ?? ""}>
            <option value="">Todos</option>
            <option value="7">7 dias</option>
            <option value="30">30 dias</option>
          </Select>
        </div>
        <div>
          <Label>Origem</Label>
          <Input name="origem" defaultValue={sp.origem ?? ""} placeholder="grupos, manual…" />
        </div>
        <div>
          <Label>Status</Label>
          <Input name="status" defaultValue={sp.status ?? ""} />
        </div>
        <div>
          <Label>SRD</Label>
          <Select name="srd" defaultValue={sp.srd ?? ""}>
            <option value="">Todos</option>
            {srds.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Retorno</Label>
          <Select name="retorno" defaultValue={sp.retorno ?? ""}>
            <option value="">—</option>
            <option value="hoje">Hoje</option>
            <option value="atrasados">Atrasados</option>
            <option value="futuros">Futuros</option>
            <option value="sem">Sem agendamento</option>
            <option value="com">Com agendamento</option>
          </Select>
        </div>
        <div>
          <Label>Busca nome</Label>
          <Input name="q" defaultValue={sp.q ?? ""} />
        </div>
        <div className="md:col-span-6">
          <Button type="submit">Filtrar</Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">WhatsApp</th>
              <th className="px-3 py-2">Origem</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">SRD</th>
              <th className="px-3 py-2">Retorno</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="px-3 py-2">{formatDate(l.created_at)}</td>
                <td className="px-3 py-2">{l.nome}</td>
                <td className="px-3 py-2">{l.whatsapp ?? "—"}</td>
                <td className="px-3 py-2">{l.origem ?? "—"}</td>
                <td className="px-3 py-2">{l.status}</td>
                <td className="px-3 py-2">{l.srd_responsavel_nome ?? "—"}</td>
                <td className="px-3 py-2">{formatDate(l.proximo_retorno_data)}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/leads/${l.id}`} className="text-amber-600 hover:underline">
                    Detalhe
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
