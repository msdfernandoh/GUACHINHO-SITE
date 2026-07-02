import { NextResponse } from "next/server";
import { fetchPublicEventoDestaque } from "@/lib/comercial-eventos/public";

export async function GET() {
  try {
    const ev = await fetchPublicEventoDestaque();
    if (!ev) return NextResponse.json({ evento: null });
    return NextResponse.json({
      evento: { slug: ev.slug, nome: ev.nome, data_evento: ev.data_evento },
    });
  } catch {
    return NextResponse.json({ evento: null });
  }
}
