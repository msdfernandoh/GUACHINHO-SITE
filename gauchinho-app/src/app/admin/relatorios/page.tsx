import Link from "next/link";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import {
  fetchConsultorReport,
  fetchCrmDashboardMetrics,
  fetchFunnelReport,
  fetchOrigemReport,
} from "@/lib/crm/reports";
import { formatCurrency } from "@/lib/utils/format";
import { LeadSummaryCards } from "@/components/admin/crm/lead-summary-cards";
import { LeadOriginReport } from "@/components/admin/crm/lead-origin-report";
import { LeadFunnelReport } from "@/components/admin/crm/lead-funnel-report";
import { LeadConsultorReport } from "@/components/admin/crm/lead-consultor-report";
import {
  adminPageSubtitleClass,
  adminPageTitleClass,
  adminSectionHeadingClass,
} from "@/components/admin/admin-contrast";

export default async function RelatoriosPage() {
  await requireStaffAdmin();
  const [metrics, origem, funil, consultores] = await Promise.all([
    fetchCrmDashboardMetrics(),
    fetchOrigemReport(),
    fetchFunnelReport(),
    fetchConsultorReport(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/leads" className="text-sm text-amber-400 hover:underline">
          ← Leads
        </Link>
        <h1 className={`mt-2 ${adminPageTitleClass}`}>Relatórios comerciais</h1>
        <p className={adminPageSubtitleClass}>Origem, funil, consultores e alertas operacionais</p>
      </div>

      <LeadSummaryCards metrics={metrics} />

      {(metrics.semResponsavel > 0 || metrics.followupsVencidos > 0) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-100">
          {metrics.semResponsavel > 0 ? (
            <p>Existem {metrics.semResponsavel} lead(s) novos sem consultor responsável.</p>
          ) : null}
          {metrics.followupsVencidos > 0 ? (
            <p className="mt-1">{metrics.followupsVencidos} follow-up(s) vencido(s).</p>
          ) : null}
        </div>
      )}

      <section>
        <h2 className={adminSectionHeadingClass}>Origem dos leads</h2>
        <LeadOriginReport rows={origem} />
      </section>

      <section>
        <h2 className={adminSectionHeadingClass}>Funil</h2>
        <LeadFunnelReport rows={funil} />
        <p className="mt-2 text-xs text-zinc-400">
          Valor potencial total em aberto: {formatCurrency(metrics.valorPotencial)}
        </p>
      </section>

      <section>
        <h2 className={adminSectionHeadingClass}>Por consultor</h2>
        <LeadConsultorReport rows={consultores} />
      </section>
    </div>
  );
}
