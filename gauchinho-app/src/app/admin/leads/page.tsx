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
    evento: sp.evento,
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
          <p className="text-sm font-medium text-zinc-400">Funil comercial, follow-ups e conversão</p>
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
