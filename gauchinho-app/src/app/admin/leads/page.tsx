import Link from "next/link";
import { Suspense } from "react";
import { fetchLeadsList, fetchSrdOptions } from "./actions";
import { fetchEventosOptionsForFilter } from "@/app/admin/eventos/actions";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canDeleteRecords } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/form-primitives";
import { LeadFilters } from "@/components/admin/crm/lead-filters";
import { LeadListWithBulk } from "@/components/admin/crm/lead-list-with-bulk";
import { ExportLeadsButton } from "@/components/admin/crm/export-leads-button";
import type { LeadFilters as LF, LeadListRow } from "@/lib/crm/types";
import type { ConsultorOption } from "@/lib/admin/consultores";

import { CrmQuickLeadButton } from "@/components/admin/crm/crm-quick-lead-button";
import { LayoutDashboard, Kanban } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LeadsListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireStaffAdmin();
  const usuario = await getUsuarioNegocio();
  const sp = await searchParams;
  const filters: LF = {
    periodo: sp.periodo,
    origem: sp.origem,
    status: sp.status,
    etapa_id: sp.etapa_id,
    srd: sp.srd,
    retorno: sp.retorno,
    q: sp.q,
    temperatura: sp.temperatura,
    produto: sp.produto,
    cidade: sp.cidade,
    sem_responsavel: sp.sem_responsavel,
    somente_novos: sp.somente_novos,
    somente_quentes: sp.somente_quentes,
    somente_incompletos: sp.somente_incompletos,
    parados_dias: sp.parados_dias,
    acao_vencida: sp.acao_vencida,
    evento: sp.evento,
    modelo_interesse: sp.modelo_interesse,
  };

  let leads: LeadListRow[] = [];
  let srds: ConsultorOption[] = [];
  let eventos: { id: string; nome: string }[] = [];
  let loadError: string | null = null;

  try {
    const [leadsRes, srdsRes, eventosRes] = await Promise.all([
      fetchLeadsList(filters),
      fetchSrdOptions().catch(() => [] as ConsultorOption[]),
      fetchEventosOptionsForFilter().catch(() => [] as { id: string; nome: string }[]),
    ]);
    leads = leadsRes;
    srds = srdsRes;
    eventos = eventosRes;
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
    console.error("[admin/leads] page load:", loadError);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads — CRM</h1>
          <p className="text-sm font-medium text-zinc-400">Lista tabular, follow-ups e conversão comercial</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/crm">
            <Button variant="outline" type="button" className="flex items-center gap-1.5 text-xs">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard CRM
            </Button>
          </Link>
          <Link href="/admin/crm/pipeline">
            <Button variant="outline" type="button" className="flex items-center gap-1.5 text-xs border-blue-500/40 text-blue-300">
              <Kanban className="h-4 w-4" />
              Pipeline Kanban
            </Button>
          </Link>
          <CrmQuickLeadButton />
          <Link href="/admin/relatorios">
            <Button variant="outline" type="button">
              Relatórios
            </Button>
          </Link>
          <Suspense fallback={null}>
            <ExportLeadsButton />
          </Suspense>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          <p className="font-semibold">Não foi possível carregar os leads.</p>
          <p className="mt-1 text-red-200/90">{loadError}</p>
          <p className="mt-2 text-xs text-red-200/70">
            Se a mensagem citar coluna ausente, aplique no Supabase o SQL{" "}
            <code className="rounded bg-black/30 px-1">038_leads_indicacao_colunas_seguro.sql</code> e
            rode <code className="rounded bg-black/30 px-1">NOTIFY pgrst, &apos;reload schema&apos;;</code>
          </p>
        </div>
      ) : null}

      <Suspense fallback={null}>
        <LeadFilters srds={srds} eventos={eventos} />
      </Suspense>

      <LeadListWithBulk
        leads={leads}
        consultores={srds}
        canDelete={canDeleteRecords(usuario?.perfil)}
      />
    </div>
  );
}
