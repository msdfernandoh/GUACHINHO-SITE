import type { CrmDashboardMetrics } from "@/lib/crm/reports";
import { formatCurrency } from "@/lib/utils/format";

export function LeadSummaryCards({ metrics }: { metrics: CrmDashboardMetrics }) {
  const cards = [
    { label: "Leads hoje", value: String(metrics.leadsHoje) },
    { label: "Últimos 7 dias", value: String(metrics.leads7d) },
    { label: "No mês", value: String(metrics.leadsMes) },
    { label: "Sem responsável", value: String(metrics.semResponsavel) },
    { label: "Follow-ups vencidos", value: String(metrics.followupsVencidos) },
    { label: "Ações hoje", value: String(metrics.proximasAcoesHoje) },
    { label: "Valor potencial", value: formatCurrency(metrics.valorPotencial) },
    { label: "Fechamentos (mês)", value: String(metrics.fechamentosMes) },
    { label: "Propostas ativas", value: String(metrics.propostasCount) },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-sm"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{c.label}</p>
          <p className="mt-2 text-2xl font-bold text-amber-400">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
