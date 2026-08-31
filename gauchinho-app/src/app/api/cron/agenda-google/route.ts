import { NextResponse } from "next/server";
import { pullAllEnabledGoogleCalendars } from "@/lib/google-calendar/pull-sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const result = await pullAllEnabledGoogleCalendars();
  return NextResponse.json({ ok: result.errors === 0, ...result }, { status: result.errors ? 503 : 200 });
}
