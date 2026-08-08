import { NextResponse } from "next/server";
import { rejectIfTenantBlocksLegacyOperationalApi } from "@/lib/tenant/assert-legacy-operational-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveIntegrationEmpresa } from "@/lib/integration/verify-api-key";
import { listGruposAutorizadosForEmpresa } from "@/lib/grupos/catalogo-autorizado-service";

/**
 * Leitura de grupos + contagem de cotas para integração (Consórcio ERP).
 * Autenticação: X-Api-Key / Bearer → empresa Gauchinho (única key atual).
 * Catálogo filtrado por concessão ATIVA da empresa da key — não lista global.
 */
export async function GET(request: Request) {
  const __tenantBlocked = await rejectIfTenantBlocksLegacyOperationalApi(request);
  if (__tenantBlocked) return __tenantBlocked;
  const auth = resolveIntegrationEmpresa(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const ativoOnly = searchParams.get("ativo") !== "false";

  try {
    let grupos = await listGruposAutorizadosForEmpresa(auth.empresaId, {
      incluirInativos: !ativoOnly,
    });
    if (ativoOnly) {
      grupos = grupos.filter((g) => g.ativo !== false && g.status !== "Inativo");
    }
    if (q) {
      const needle = q.toLowerCase();
      grupos = grupos.filter((g) => g.codigo_grupo.toLowerCase().includes(needle));
    }

    const admin = createAdminClient();
    const groupIds = grupos.map((row) => row.id);
    const activeCountByGroup = new Map<string, number>();
    if (groupIds.length > 0) {
      const { data: activeQuotas, error: activeQuotasError } = await admin
        .from("grupos_cotas")
        .select("grupo_id")
        .in("grupo_id", groupIds)
        .eq("ativo", true);
      if (activeQuotasError) {
        return NextResponse.json({ error: activeQuotasError.message }, { status: 500 });
      }
      for (const quota of activeQuotas ?? []) {
        activeCountByGroup.set(
          quota.grupo_id,
          (activeCountByGroup.get(quota.grupo_id) ?? 0) + 1,
        );
      }
    }

    const data = grupos.map((row) => ({
      id: row.id,
      codigo_grupo: row.codigo_grupo,
      modalidade: row.modalidade,
      administradora: row.administradora,
      status: row.status,
      ativo: row.ativo,
      prazo_total: row.prazo_total,
      taxa_administrativa_percentual: row.taxa_administrativa_percentual,
      fundo_reserva_percentual: row.fundo_reserva_percentual,
      updated_at: row.updated_at,
      cotas_count: activeCountByGroup.get(String(row.id)) ?? 0,
    }));

    return NextResponse.json(
      {
        success: true,
        api_version: "1",
        count: data.length,
        data,
        synced_at: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao listar grupos" },
      { status: 500 },
    );
  }
}
