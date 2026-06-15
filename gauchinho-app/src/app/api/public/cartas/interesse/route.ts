import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarEvento } from "@/lib/eventos/registrar";
import { DEFAULT_LEADS, getConfigJsonPublic } from "@/server/config";
import { resolveWhatsappOrigem } from "@/lib/whatsapp/resolve-origem";
import { CARTA_TIPOS } from "@/lib/cartas/types";

type Body = {
  cartaId: string;
  nome: string;
  whatsapp: string;
  cidade?: string;
  email?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.cartaId || !body.nome?.trim() || !body.whatsapp?.trim()) {
      return NextResponse.json({ error: "Carta, nome e WhatsApp obrigatórios" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: carta, error: cartaErr } = await admin
      .from("cartas_contempladas")
      .select("*")
      .eq("id", body.cartaId)
      .eq("ativo", true)
      .in("status", ["disponivel", "consultar_disponibilidade"])
      .maybeSingle();

    if (cartaErr || !carta) {
      return NextResponse.json({ error: "Carta indisponível" }, { status: 404 });
    }

    const leadsConfig = await getConfigJsonPublic("leads", DEFAULT_LEADS);
    const tipoLabel = CARTA_TIPOS.find((t) => t.value === carta.tipo_carta)?.label ?? "Carta";

    const cartaSnapshot = {
      id: carta.id,
      tipo_carta: carta.tipo_carta,
      administradora: carta.administradora,
      credito: carta.credito,
      entrada: carta.entrada,
      prazo_quantidade: carta.prazo_quantidade,
      valor_parcela: carta.valor_parcela,
      saldo_devedor: carta.saldo_devedor,
      proxima_parcela_data: carta.proxima_parcela_data,
      taxa_transferencia: carta.taxa_transferencia,
      status: carta.status,
    };

    const { data: leadRow, error: leadErr } = await admin
      .from("leads")
      .insert({
        nome: body.nome.trim(),
        whatsapp: body.whatsapp.trim(),
        email: body.email?.trim() || null,
        cidade: body.cidade?.trim() || null,
        origem: "carta_contemplada",
        origem_detalhe: carta.administradora,
        tipo_interesse: "carta_contemplada",
        produto_interesse: carta.tipo_carta,
        valor_simulado: carta.credito,
        prazo_simulado: carta.prazo_quantidade,
        entrada: carta.entrada,
        carta_contemplada_id: carta.id,
        dados_simulacao: { carta: cartaSnapshot, tipoLabel },
        resultado_resumido: `${tipoLabel} ${carta.administradora ?? ""} — crédito ${carta.credito}`,
        status: leadsConfig.statusInicialPadrao,
        criado_manual: false,
      })
      .select("id")
      .single();

    if (leadErr || !leadRow) {
      return NextResponse.json({ error: leadErr?.message ?? "Lead falhou" }, { status: 500 });
    }

    const leadId = leadRow.id;
    const origem = "carta_contemplada";

    await registrarEvento({
      tipo_evento: "lead_criado",
      origem,
      pagina: "/cartas-contempladas",
      lead_id: leadId,
      carta_id: carta.id,
      dados_evento: { carta_id: carta.id },
    });
    await registrarEvento({
      tipo_evento: "carta_interesse",
      origem,
      pagina: "/cartas-contempladas",
      lead_id: leadId,
      carta_id: carta.id,
      entidade_tipo: "carta_contemplada",
      entidade_id: carta.id,
      dados_evento: { administradora: carta.administradora },
    });

    const whatsappOrigem = await resolveWhatsappOrigem(origem);

    return NextResponse.json({
      ok: true,
      leadId,
      whatsappOrigem,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
