import Link from "next/link";
import { Suspense } from "react";
import { fetchLeadsList, fetchSrdOptions } from "./actions";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import { Button } from "@/components/ui/form-primitives";
import { LeadFilters } from "@/components/admin/crm/lead-filters";
import { LeadTable } from "@/components/admin/crm/lead-table";
import { ExportCsvButton } from "@/components/admin/crm/export-csv-button";
import type { LeadFilters as LF } from "@/lib/crm/types";

export default async function LeadsListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireStaffAdmin();
  const sp = await searchParams;
  const filters: LF = {
    periodo: sp.periodo,
    origem: sp.origem,
    status: sp.status,
    srd: sp.srd,
    retorno: sp.retorno,
    q: sp.q,
    temperatura: sp.temperatura,
    produto: sp.produto,
    cidade: sp.cidade,
    sem_responsavel: sp.sem_responsavel,
    somente_novos: sp.somente_novos,
    somente_quentes: sp.somente_quentes,
    acao_vencida: sp.acao_vencida,
  };
  const [leads, srds] = await Promise.all([fetchLeadsList(filters), fetchSrdOptions()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Leads — CRM</h1>
          <p className="text-sm text-zinc-500">Funil comercial, follow-ups e conversão</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/relatorios">
            <Button variant="outline" type="button">
              Relatórios
            </Button>
          </Link>
          <Link href="/admin/leads/novo">
            <Button>Novo lead manual</Button>
          </Link>
          <Suspense fallback={null}>
            <ExportCsvButton />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={null}>
        <LeadFilters srds={srds} />
      </Suspense>

      <LeadTable leads={leads} />
    </div>
  );
}
