import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canDeleteRecords } from "@/lib/auth/permissions";
import { queryLeadsList } from "@/lib/crm/leads-query";
import { filterLeadsByScope, loadLeadAccessScope } from "@/lib/crm/lead-access";
import { fetchSrdOptions } from "@/app/admin/leads/actions";
import { fetchEventosOptionsForFilter } from "@/app/admin/eventos/actions";
import { ErpLeadsView } from "@/components/erp/crm/erp-leads-view";
import type { LeadFilters as LF, LeadListRow } from "@/lib/crm/types";
import type { ConsultorOption } from "@/lib/admin/consultores";

export const dynamic = "force-dynamic";

export default async function ErpLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { empresaAtiva } = await getCurrentTenantContext();
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

  try {
    const [rawLeads, srdsRes, eventosRes] = await Promise.all([
      queryLeadsList(filters, 500),
      fetchSrdOptions().catch(() => [] as ConsultorOption[]),
      fetchEventosOptionsForFilter().catch(() => [] as { id: string; nome: string }[]),
    ]);

    srds = srdsRes;
    eventos = eventosRes;

    if (usuario) {
      const scope = await loadLeadAccessScope(
        usuario.id,
        usuario.perfil,
        Boolean(usuario.leads_apenas_proprios),
      );
      leads = filterLeadsByScope(rawLeads, scope);
    } else {
      leads = rawLeads;
    }
  } catch (e) {
    console.error("[erp/leads] load error:", e);
  }

  const canDelete = usuario ? canDeleteRecords(usuario.perfil) : false;

  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-semibold">Carregando CRM / Leads...</div>}>
      <ErpLeadsView
        initialLeads={leads}
        consultores={srds}
        eventos={eventos}
        currentFilters={filters}
        canDelete={canDelete}
      />
    </Suspense>
  );
}
