import Link from "next/link";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { queryLeadsForKanban, fetchCrmFunilEtapas } from "@/lib/crm/leads-query";
import { fetchSrdOptions } from "@/app/admin/leads/actions";
import { loadLeadAccessScope, filterLeadsByScope } from "@/lib/crm/lead-access";
import { CrmKanbanBoard } from "@/components/admin/crm/crm-kanban-board";
import { CrmQuickLeadButton } from "@/components/admin/crm/crm-quick-lead-button";
import { ArrowLeft, LayoutDashboard, List } from "lucide-react";
import { Button } from "@/components/ui/form-primitives";
import type { LeadFilters } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

export default async function CrmPipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireStaffAdmin();
  const { empresaAtiva, usuario } = await getCurrentTenantContext();

  if (!empresaAtiva || !usuario) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-6 text-red-200">
        Empresa ativa ou usuário não identificado.
      </div>
    );
  }

  const sp = await searchParams;
  const etapaParam =
    sp.etapa || sp.etapa_slug || sp.etapa_id || (sp.perdidos === "1" ? "perdido" : undefined);
  const faseParam = sp.fase || sp.macro;

  const filters: LeadFilters = {
    periodo: sp.periodo,
    origem: sp.origem,
    status: sp.status,
    etapa_id: sp.etapa_id,
    etapa: etapaParam,
    fase: faseParam,
    srd: sp.srd,
    q: sp.q,
    temperatura: sp.temperatura,
    produto: sp.produto,
    cidade: sp.cidade,
    sem_responsavel: sp.sem_responsavel,
    somente_novos: sp.somente_novos,
    somente_quentes: sp.somente_quentes,
    somente_incompletos: sp.somente_incompletos,
    parados_dias: sp.parados_dias,
    modelo_interesse: sp.modelo_interesse,
  };

  // Para o Kanban interativo, carregamos o conjunto da empresa para permitir chaveamento
  // dinâmico em tempo real de colunas e garantir preservação de leads legados baseados em status.
  const filtersForKanbanQuery: LeadFilters = {
    ...filters,
    etapa_id: undefined,
  };

  const [rawLeads, etapas, consultores] = await Promise.all([
    queryLeadsForKanban(filtersForKanbanQuery, empresaAtiva),
    fetchCrmFunilEtapas(empresaAtiva.id),
    fetchSrdOptions().catch(() => []),
  ]);

  // Aplica escopo de segurança por perfil (ex: consultor vê só os seus se configurado)
  const scope = await loadLeadAccessScope(
    usuario.id,
    usuario.perfil,
    usuario.leads_apenas_proprios,
  );
  const leads = filterLeadsByScope(rawLeads, scope);

  return (
    <div className="space-y-4">
      {/* Cabeçalho do Pipeline */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/crm"
              className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar ao Dashboard CRM
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-zinc-100">Pipeline Comercial — Funil de Vendas</h1>
          <p className="text-xs text-zinc-400">
            Arraste os cards entre as colunas para atualizar a fase do lead e planejar próximas ações
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/crm">
            <Button variant="outline" type="button" className="flex items-center gap-1.5 text-xs">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Link href="/admin/leads">
            <Button variant="outline" type="button" className="flex items-center gap-1.5 text-xs">
              <List className="h-4 w-4" />
              Modo Lista
            </Button>
          </Link>
          <CrmQuickLeadButton />
        </div>
      </div>

      {/* Kanban Board com Drag & Drop */}
      <CrmKanbanBoard
        initialLeads={leads}
        etapas={etapas}
        consultores={consultores}
        currentUserId={usuario.id}
        initialFilters={filters}
        initialStageFilter={
          faseParam ? `fase:${faseParam}` : etapaParam ? `etapa:${etapaParam}` : undefined
        }
      />
    </div>
  );
}
