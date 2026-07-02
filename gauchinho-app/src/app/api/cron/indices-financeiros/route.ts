import { NextResponse } from "next/server";
import { refreshTodosAutomaticos } from "@/lib/indices-financeiros/refresh";

/**
 * Cron mensal (Vercel) — atualiza índices com `atualizacao_automatica`.
 * Protegido por CRON_SECRET no header Authorization: Bearer ...
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await refreshTodosAutomaticos();
  const falhas = results.filter((r) => !r.ok);
  return NextResponse.json({
    ok: falhas.length === 0,
    results,
    atualizado_em: new Date().toISOString(),
  });
}
