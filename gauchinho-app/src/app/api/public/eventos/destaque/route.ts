import { NextResponse } from "next/server";
import { rejectIfTenantBlocksLegacyOperationalApi } from "@/lib/tenant/assert-legacy-operational-api";
import { fetchPublicEventoDestaque } from "@/lib/comercial-eventos/public";

export async function GET(request: Request) {
  const __tenantBlocked = await rejectIfTenantBlocksLegacyOperationalApi(request);
  if (__tenantBlocked) return __tenantBlocked;
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
