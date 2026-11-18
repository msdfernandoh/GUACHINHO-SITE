import { NextResponse } from "next/server";
import { processarFilaWhatsapp } from "@/lib/whatsapp/cloud-api/envios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Roda a cada minuto: dispara campanhas no ritmo configurado e alimenta as automações. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await processarFilaWhatsapp()) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha" }, { status: 503 });
  }
}
