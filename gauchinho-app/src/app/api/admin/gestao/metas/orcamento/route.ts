import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantPermission } from "@/lib/tenant/context";
import { requireGestaoApiAccess, gestaoApiMessage, gestaoApiStatus, GestaoApiError } from "@/lib/gestao/api-access";

export async function GET() {
  try {
    const { empresaId } = await requireGestaoApiAccess("read");
    const { empresaAtiva } = await requireTenantPermission("gerenciar_financeiro");
    if (empresaAtiva.id !== empresaId) throw new GestaoApiError("Empresa ativa divergente.");
    const admin = createAdminClient();
    const itens = [];
    for (let inicio = 0; ; inicio += 500) {
      const { data, error } = await admin.from("financeiro_previsoes_orcamento")
        .select("id,competencia,categoria,tipo,valor_previsto_admin,observacoes")
        .eq("empresa_id", empresaId).order("competencia", { ascending: false }).order("id")
        .range(inicio, inicio + 499);
      if (error) throw new Error("Não foi possível carregar o orçamento financeiro.");
      itens.push(...(data || []));
      if ((data || []).length < 500) break;
      if (inicio >= 100000) throw new Error("Volume do orçamento excede o limite desta consulta.");
    }
    return NextResponse.json(itens, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: gestaoApiMessage(error) }, { status: gestaoApiStatus(error) });
  }
}
