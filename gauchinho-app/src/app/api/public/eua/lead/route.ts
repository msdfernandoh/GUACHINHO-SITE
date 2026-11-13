import { NextResponse } from "next/server";
import { authorizePublicIngress } from "@/lib/security/public-ingress";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarEvento } from "@/lib/eventos/registrar";
import { DEFAULT_LEADS, getConfigJsonPublic } from "@/server/config";
import { upsertLeadPorTelefone } from "@/lib/crm/upsert-lead";
import { EUA_LEAD_ORIGEM, parseEuaLeadBody } from "@/lib/eua-landing/lead";

export async function POST(request: Request) {
  const ingress = await authorizePublicIngress(request, "lead_landing_eua", { limit: 10 });
  if (!ingress.ok) return ingress.response;
  try {
    const parsed = parseEuaLeadBody(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const admin = createAdminClient();
    const leadsConfig = await getConfigJsonPublic("leads", DEFAULT_LEADS);
    const referer = request.headers.get("referer");
    const result = await upsertLeadPorTelefone(admin, {
      ...parsed.payload,
      empresa_id: ingress.empresaId,
      parceiro_id: ingress.parceiroSiteId ?? null,
      host_origem: request.headers.get("host"),
      pagina_origem: referer,
      status: leadsConfig.statusInicialPadrao ?? "Novo",
    });
    if (!result.ok || !result.lead_id) {
      return NextResponse.json({ error: result.error ?? "Falha ao salvar contato." }, { status: 500 });
    }

    await registrarEvento({
      empresa_id: ingress.empresaId,
      tipo_evento: parsed.payload.origem_detalhe === "eua_reuniao" ? "reuniao_solicitada" : "lead_criado",
      origem: EUA_LEAD_ORIGEM,
      pagina: referer ?? "/eua",
      lead_id: result.lead_id,
      dados_evento: {
        acao: parsed.payload.origem_detalhe,
        ...(ingress.parceiroSiteId ? { parceiro_site_id: ingress.parceiroSiteId } : {}),
      },
    });

    return NextResponse.json({ ok: true, leadId: result.lead_id });
  } catch (e) {
    console.error("[eua-lead]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível enviar agora. Tente novamente." }, { status: 500 });
  }
}
