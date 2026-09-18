import Link from "next/link";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { fetchCrmDashboardData } from "@/lib/crm/dashboard-query";
import { CrmPerformancePanel } from "@/components/admin/crm/crm-performance-panel";
import { ArrowLeft, LayoutDashboard, Kanban } from "lucide-react";
import { Button } from "@/components/ui/form-primitives";

export const dynamic = "force-dynamic";

export default async function CrmPerformancePage() {
  await requireStaffAdmin();
  const { empresaAtiva } = await getCurrentTenantContext();

  if (!empresaAtiva) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-6 text-red-200">
        Empresa ativa não identificada.
      </div>
    );
  }

  const data = await fetchCrmDashboardData(empresaAtiva.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/crm"
            className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao Dashboard CRM
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-zinc-100">Painel de Performance Comercial</h1>
          <p className="text-xs text-zinc-400">
            Visão consolidada de produção, intensidade de reuniões e conversão por consultor e SDR
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/crm">
            <Button variant="outline" type="button" className="flex items-center gap-1.5 text-xs">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Link href="/admin/crm/pipeline">
            <Button variant="outline" type="button" className="flex items-center gap-1.5 text-xs">
              <Kanban className="h-4 w-4" />
              Pipeline
            </Button>
          </Link>
        </div>
      </div>

      <CrmPerformancePanel performance={data.performance} />
    </div>
  );
}
