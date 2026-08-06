import { NextResponse } from "next/server";
import { rejectIfTenantBlocksLegacyOperationalApi } from "@/lib/tenant/assert-legacy-operational-api";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const __tenantBlocked = await rejectIfTenantBlocksLegacyOperationalApi(request);
  if (__tenantBlocked) return __tenantBlocked;
  const sp = new URL(request.url).searchParams;
  const ano = sp.get("ano");
  const mes = sp.get("mes");
  const grupoId = sp.get("grupoId");

  const supabase = await createClient();
  let q = supabase
    .from("grupos_sorteios_loteria")
    .select(
      "id, grupo_id, ano, mes, primeiro_premio, quantidade_cotas, palavra_chave, data_sorteio, fonte_resultado, resultado_buscado_automaticamente, periodo_ref, grupo:grupos_consorcio(codigo_grupo, modalidade)",
    )
    .order("ano", { ascending: false })
    .order("mes", { ascending: false })
    .limit(300);

  if (ano) q = q.eq("ano", Number(ano));
  if (mes) q = q.eq("mes", Number(mes));
  if (grupoId) q = q.eq("grupo_id", grupoId);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rows: data ?? [] });
}
