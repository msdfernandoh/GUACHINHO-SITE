import { NextResponse } from "next/server";
import { rejectIfTenantBlocksLegacyOperationalApi } from "@/lib/tenant/assert-legacy-operational-api";
import { fetchPublicEventoBySlug } from "@/lib/comercial-eventos/public";
import { inscreverParticipanteEvento } from "@/lib/comercial-eventos/inscricao";
import type { InscricaoEventoPayload } from "@/lib/comercial-eventos/types";

export async function POST(request: Request) {
  const __tenantBlocked = await rejectIfTenantBlocksLegacyOperationalApi(request);
  if (__tenantBlocked) return __tenantBlocked;
  try {
    const body = (await request.json()) as InscricaoEventoPayload & { slug?: string };
    const slug = body.slug?.trim();
    if (!slug) return NextResponse.json({ error: "Evento inválido" }, { status: 400 });

    const evento = await fetchPublicEventoBySlug(slug);
    if (!evento) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });

    const result = await inscreverParticipanteEvento(evento, body);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao inscrever";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
