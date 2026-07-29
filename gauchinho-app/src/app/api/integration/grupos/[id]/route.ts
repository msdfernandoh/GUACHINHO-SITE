import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyIntegrationApiKey } from "@/lib/integration/verify-api-key";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = verifyIntegrationApiKey(request);
  if (denied) return denied;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: grupo, error: gErr } = await admin
      .from("grupos_consorcio")
      .select("*")
      .eq("id", id)
      .single();

    if (gErr || !grupo) {
      return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });
    }

    const { data: cotas, error: cErr } = await admin
      .from("grupos_cotas")
      .select(
        "id, grupo_id, valor_credito, saldo_devedor, valor_parcela, parcela_integral, parcela_reduzida, parcela_sem_seguro, parcela_com_seguro, status, ativo, ordem, updated_at",
      )
      .eq("grupo_id", id)
      .order("ordem", { ascending: true });

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }

    const cotasAtivas = (cotas ?? []).filter((c) => c.ativo !== false);

    return NextResponse.json(
      {
        success: true,
        api_version: "1",
        grupo,
        cotas: cotasAtivas,
        cotas_total: cotas?.length ?? 0,
        cotas_ativas: cotasAtivas.length,
        synced_at: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao buscar grupo" },
      { status: 500 },
    );
  }
}
