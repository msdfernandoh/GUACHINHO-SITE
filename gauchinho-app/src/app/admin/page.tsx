import Link from "next/link";
import {
  fetchDashboardStats,
  fetchLeadsRetornoAgendado,
  fetchUltimasPropostas,
  fetchUltimosLeads,
} from "@/server/dashboard";
import { Card } from "@/components/ui/form-primitives";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";

const cards = [
  { key: "leadsNovos", label: "Leads novos" },
  { key: "leadsEmAtendimento", label: "Em atendimento" },
  { key: "leadsRetornoAgendado", label: "Retorno agendado" },
  { key: "leadsFechados", label: "Leads fechados" },
  { key: "valorTotalFechado", label: "Valor fechado", money: true },
  { key: "propostasGeradas", label: "Propostas ativas" },
  { key: "gruposAtivos", label: "Grupos ativos" },
  { key: "cotasDisponiveis", label: "Cotas disponíveis" },
] as const;

export default async function AdminDashboardPage() {
  await requireStaffAdmin();
  const [stats, ultimosLeads, retornos, propostas] = await Promise.all([
    fetchDashboardStats(),
    fetchUltimosLeads(),
    fetchLeadsRetornoAgendado(),
    fetchUltimasPropostas(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-zinc-500">
          Visão operacional do dia —{" "}
          <Link href="/admin/relatorios" className="text-amber-600 hover:underline">
            relatórios comerciais
          </Link>
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const raw = stats[c.key];
          const value =
            "money" in c && c.money
              ? formatCurrency(raw as number)
              : String(raw);
          return (
            <Card key={c.key}>
              <p className="text-xs font-medium uppercase text-zinc-500">{c.label}</p>
              <p className="mt-2 text-2xl font-bold">{value}</p>
            </Card>
          );
        })}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Últimos leads</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">WhatsApp</th>
                <th className="px-3 py-2">Origem</th>
                <th className="px-3 py-2">Interesse</th>
                <th className="px-3 py-2">SRD</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Retorno</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {ultimosLeads.map((l) => (
                <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2">{formatDate(l.created_at)}</td>
                  <td className="px-3 py-2">{l.nome}</td>
                  <td className="px-3 py-2">{l.whatsapp ?? "—"}</td>
                  <td className="px-3 py-2">{l.origem ?? "—"}</td>
                  <td className="px-3 py-2">{l.tipo_interesse ?? "—"}</td>
                  <td className="px-3 py-2">{l.srd_responsavel_nome ?? "—"}</td>
                  <td className="px-3 py-2">{l.status}</td>
                  <td className="px-3 py-2">
                    {formatDateTime(l.proximo_retorno_data, l.proximo_retorno_hora)}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/leads/${l.id}`} className="text-amber-600 hover:underline">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Retornos agendados</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
              <tr>
                <th className="px-3 py-2">Data retorno</th>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">WhatsApp</th>
                <th className="px-3 py-2">Interesse</th>
                <th className="px-3 py-2">SRD</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {retornos.map((l) => (
                <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2">
                    {formatDateTime(l.proximo_retorno_data, l.proximo_retorno_hora)}
                  </td>
                  <td className="px-3 py-2">{l.nome}</td>
                  <td className="px-3 py-2">{l.whatsapp ?? "—"}</td>
                  <td className="px-3 py-2">{l.tipo_interesse ?? "—"}</td>
                  <td className="px-3 py-2">{l.srd_responsavel_nome ?? "—"}</td>
                  <td className="px-3 py-2">{l.status}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/leads/${l.id}`} className="text-amber-600 hover:underline">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Últimas propostas</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Crédito</th>
                <th className="px-3 py-2">Consultor</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {propostas.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2">{formatDate(p.created_at)}</td>
                  <td className="px-3 py-2">{p.nome_cliente ?? "—"}</td>
                  <td className="px-3 py-2">{p.tipo_proposta ?? "—"}</td>
                  <td className="px-3 py-2">{formatCurrency(Number(p.valor_credito))}</td>
                  <td className="px-3 py-2">{p.consultor_nome ?? "—"}</td>
                  <td className="px-3 py-2">{p.status}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/propostas/${p.id}`}
                      className="text-amber-600 hover:underline"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
