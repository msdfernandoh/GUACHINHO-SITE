import { NextResponse } from "next/server";
import { rejectIfTenantBlocksLegacyOperationalApi } from "@/lib/tenant/assert-legacy-operational-api";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GRUPO_NOT_FOUND_MESSAGE,
  isGrupoNotFoundError,
} from "@/lib/grupos/catalogo-autorizado";
import {
  assertEmpresaPodeAcessarGrupo,
  listGruposAutorizadosForEmpresa,
} from "@/lib/grupos/catalogo-autorizado-service";
import { getCatalogEmpresaIdFromRequest } from "@/lib/grupos/resolve-catalog-empresa";

type SorteioRow = {
  id: string;
  grupo_id: string;
  ano: number;
  mes: number;
  primeiro_premio: string;
  quantidade_cotas: number;
  palavra_chave: number;
  data_sorteio: string | null;
  fonte_resultado: string | null;
  resultado_buscado_automaticamente: boolean;
  periodo_ref: string;
  grupo?: { codigo_grupo: string; modalidade: string } | null;
};

/**
 * Histórico de sorteios — tenant-scoped via concessão (service role).
 * Não usa join anon em grupos_consorcio (compatível pós-migration 049).
 */
export async function GET(request: Request) {
  const __tenantBlocked = await rejectIfTenantBlocksLegacyOperationalApi(request);
  if (__tenantBlocked) return __tenantBlocked;

  const empresaId = await getCatalogEmpresaIdFromRequest(request);
  if (!empresaId) {
    return NextResponse.json({ rows: [] }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const sp = new URL(request.url).searchParams;
  const ano = sp.get("ano");
  const mes = sp.get("mes");
  const grupoId = sp.get("grupoId")?.trim();

  try {
    if (grupoId) {
      await assertEmpresaPodeAcessarGrupo(empresaId, grupoId);
    }

    const gruposAutorizados = await listGruposAutorizadosForEmpresa(empresaId);
    const grupoMeta = new Map(
      gruposAutorizados.map((g) => [
        g.id,
        { codigo_grupo: g.codigo_grupo, modalidade: g.modalidade },
      ]),
    );

    let grupoIds = [...grupoMeta.keys()];
    if (grupoId) {
      grupoIds = grupoIds.filter((id) => id === grupoId);
      if (grupoIds.length === 0) {
        return NextResponse.json({ error: GRUPO_NOT_FOUND_MESSAGE }, { status: 404 });
      }
    }
    if (grupoIds.length === 0) {
      return NextResponse.json({ rows: [] }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const admin = createAdminClient();
    let q = admin
      .from("grupos_sorteios_loteria")
      .select(
        "id, grupo_id, ano, mes, primeiro_premio, quantidade_cotas, palavra_chave, data_sorteio, fonte_resultado, resultado_buscado_automaticamente, periodo_ref",
      )
      .in("grupo_id", grupoIds)
      .order("ano", { ascending: false })
      .order("mes", { ascending: false })
      .limit(300);

    if (ano) q = q.eq("ano", Number(ano));
    if (mes) q = q.eq("mes", Number(mes));

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows: SorteioRow[] = (data ?? []).map((row) => {
      const meta = grupoMeta.get(row.grupo_id);
      return {
        ...row,
        grupo: meta
          ? { codigo_grupo: meta.codigo_grupo, modalidade: meta.modalidade }
          : null,
      };
    });

    return NextResponse.json(
      { rows },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    if (isGrupoNotFoundError(err)) {
      return NextResponse.json({ error: GRUPO_NOT_FOUND_MESSAGE }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
