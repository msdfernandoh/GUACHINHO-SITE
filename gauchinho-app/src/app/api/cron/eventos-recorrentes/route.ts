import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Executado diariamente pela Vercel às 03:00 (America/Cuiaba).
 * A RPC é idempotente: somente gera a próxima edição de uma série semanal
 * após a edição atual já ter ocorrido.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "CRON_SECRET não configurado" },
      { status: 503 },
    );
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient({ noStore: true });
  const { data, error } = await admin.rpc("rpc_processar_eventos_recorrentes");
  if (error) {
    console.error("[cron/eventos-recorrentes]", error.message);
    return NextResponse.json(
      { error: "Não foi possível processar os eventos recorrentes." },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: Boolean(data?.ok),
    ...data,
    processado_em: new Date().toISOString(),
  });
}
