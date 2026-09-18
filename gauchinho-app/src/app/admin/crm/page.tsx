import Link from "next/link";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { fetchCrmDashboardData } from "@/lib/crm/dashboard-query";
import { CrmFunnelDashboard } from "@/components/admin/crm/crm-funnel-dashboard";
import { CrmQuickLeadButton } from "@/components/admin/crm/crm-quick-lead-button";
import { Kanban, List, BarChart3, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/form-primitives";

export const dynamic = "force-dynamic";

export default async function CrmDashboardPage() {
  await requireStaffAdmin();
  const { empresaAtiva } = await getCurrentTenantContext();

  if (!empresaAtiva) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-6 text-red-200">
        Empresa ativa não identificada para carregar o CRM.
      </div>
    );
  }

  const data = await fetchCrmDashboardData(empresaAtiva.id);

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Área Logada — CRM */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-blue-400">
              Módulo Comercial
            </span>
            <span className="text-xs text-zinc-500">•</span>
            <span className="text-xs text-zinc-400">{empresaAtiva.nome_fantasia}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-zinc-100">CRM — Gestão de Leads e Vendas</h1>
          <p className="text-xs text-zinc-400">
            Acompanhamento em tempo real do funil, atividades e conversão de oportunidades
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/crm/materiais">
            <Button variant="outline" type="button" className="flex items-center gap-1.5 text-xs">
              <BookOpen className="h-4 w-4" />
              Materiais & Scripts
            </Button>
          </Link>
          <Link href="/admin/crm/performance">
            <Button variant="outline" type="button" className="flex items-center gap-1.5 text-xs">
              <BarChart3 className="h-4 w-4" />
              Performance
            </Button>
          </Link>
          <Link href="/admin/leads">
            <Button variant="outline" type="button" className="flex items-center gap-1.5 text-xs">
              <List className="h-4 w-4" />
              Lista de Leads
            </Button>
          </Link>
          <Link href="/admin/crm/pipeline">
            <Button variant="outline" type="button" className="flex items-center gap-1.5 text-xs border-blue-500/40 text-blue-300">
              <Kanban className="h-4 w-4" />
              Pipeline Kanban
            </Button>
          </Link>
          <CrmQuickLeadButton />
        </div>
      </div>

      {/* Dashboard Visual do Funil e Alertas */}
      <CrmFunnelDashboard data={data} />
    </div>
  );
}
