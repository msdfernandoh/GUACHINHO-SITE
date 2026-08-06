import { NextResponse } from "next/server";
import { rejectIfTenantBlocksLegacyOperationalApi } from "@/lib/tenant/assert-legacy-operational-api";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import { queryLeadsList } from "@/lib/crm/leads-query";
import { leadsToCsv } from "@/lib/crm/csv-export";
import { filterLeadsByScope, loadLeadAccessScope } from "@/lib/crm/lead-access";
import type { LeadFilters } from "@/lib/crm/types";

function filtersFromSearchParams(sp: URLSearchParams): LeadFilters {
  const get = (k: string) => sp.get(k) ?? undefined;
  return {
    periodo: get("periodo"),
    origem: get("origem"),
    status: get("status"),
    srd: get("srd"),
    retorno: get("retorno"),
    q: get("q"),
    temperatura: get("temperatura"),
    produto: get("produto"),
    cidade: get("cidade"),
    sem_responsavel: get("sem_responsavel"),
    somente_novos: get("somente_novos"),
    somente_quentes: get("somente_quentes"),
    acao_vencida: get("acao_vencida"),
    evento: get("evento"),
  };
}

export async function GET(request: Request) {
  const __tenantBlocked = await rejectIfTenantBlocksLegacyOperationalApi(request);
  if (__tenantBlocked) return __tenantBlocked;
  await requireStaffAdmin();
  const usuario = await getUsuarioNegocio();
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const sp = new URL(request.url).searchParams;
  const format = sp.get("format") === "xls" ? "xls" : "csv";
  let rows = await queryLeadsList(filtersFromSearchParams(sp), 5000);
  const scope = await loadLeadAccessScope(
    usuario.id,
    usuario.perfil,
    usuario.leads_apenas_proprios,
  );
  rows = filterLeadsByScope(rows, scope);

  const csv = leadsToCsv(rows);
  const date = new Date().toISOString().slice(0, 10);
  if (format === "xls") {
    const bom = "\uFEFF";
    return new NextResponse(bom + csv.replace(/,/g, ";"), {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${date}.xls"`,
      },
    });
  }
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${date}.csv"`,
    },
  });
}
