import { NextResponse } from "next/server";
import { rejectIfTenantBlocksLegacyOperationalApi } from "@/lib/tenant/assert-legacy-operational-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyIntegrationApiKey } from "@/lib/integration/verify-api-key";

/**
 * Leitura de grupos + contagem de cotas para integração (Consórcio ERP).
 * Autenticação: header X-Api-Key ou Authorization: Bearer <GAUCHINHO_INTEGRATION_API_KEY>
 */
export async function GET(request: Request) {
  const __tenantBlocked = await rejectIfTenantBlocksLegacyOperationalApi(request);
  if (__tenantBlocked) return __tenantBlocked;
  const denied = verifyIntegrationApiKey(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const ativoOnly = searchParams.get("ativo") !== "false";

  try {
    const admin = createAdminClient();
    let query = admin
      .from("grupos_consorcio")
      .select(
        "id, codigo_grupo, modalidade, administradora, status, ativo, prazo_total, taxa_administrativa_percentual, fundo_reserva_percentual, updated_at",
      )
      .order("codigo_grupo", { ascending: true });

    if (ativoOnly) query = query.eq("ativo", true);
    if (q) query = query.ilike("codigo_grupo", `%${q}%`);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const groupIds = (data ?? []).map((row) => row.id);
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

    const grupos = (data ?? []).map((row) => {
      return { ...row, cotas_count: activeCountByGroup.get(String(row.id)) ?? 0 };
    });

    return NextResponse.json(
      {
        success: true,
        api_version: "1",
        count: grupos.length,
        data: grupos,
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
