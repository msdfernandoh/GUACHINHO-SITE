import { NextResponse } from "next/server";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import { queryLeadsList } from "@/lib/crm/leads-query";
import { leadsToCsv } from "@/lib/crm/csv-export";
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
  };
}

export async function GET(request: Request) {
  await requireStaffAdmin();
  const sp = new URL(request.url).searchParams;
  const rows = await queryLeadsList(filtersFromSearchParams(sp), 5000);
  const csv = leadsToCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
