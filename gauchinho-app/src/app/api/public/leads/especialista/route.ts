import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarEvento } from "@/lib/eventos/registrar";
import { DEFAULT_LEADS, getConfigJsonPublic } from "@/server/config";
import { resolveWhatsappOrigem } from "@/lib/whatsapp/resolve-origem";
import { TIPOS_CREDITO_PUBLICO, type TipoCreditoPublico } from "@/lib/leads/tipo-credito";

type Body = {
  nome: string;
  whatsapp: string;
  tipoCredito?: string;
  valorCredito?: number | string | null;
  observacao?: string | null;
};

const ORIGEM = "especialista";

function parseValor(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.nome?.trim() || !body.whatsapp?.trim()) {
      return NextResponse.json({ error: "Nome e telefone/WhatsApp são obrigatórios" }, { status: 400 });
    }

    const tipoCredito = body.tipoCredito?.trim() || null;
    if (tipoCredito && !TIPOS_CREDITO_PUBLICO.includes(tipoCredito as TipoCreditoPublico)) {
      return NextResponse.json({ error: "Tipo de crédito inválido" }, { status: 400 });
    }

    const valorCredito = parseValor(body.valorCredito);
    const admin = createAdminClient();
    const leadsConfig = await getConfigJsonPublic("leads", DEFAULT_LEADS);

    const { data: leadRow, error: leadErr } = await admin
      .from("leads")
      .insert({
        nome: body.nome.trim(),
        whatsapp: body.whatsapp.trim(),
        email: null,
        origem: ORIGEM,
        origem_detalhe: "header_especialista",
        tipo_interesse: tipoCredito ?? "outro",
        tipo_credito: tipoCredito,
        valor_credito: valorCredito,
        valor_estimado: valorCredito,
        valor_simulado: valorCredito,
        observacao_indicacao: body.observacao?.trim() || null,
        observacoes: body.observacao?.trim() || null,
        status: leadsConfig.statusInicialPadrao ?? "Novo",
        criado_manual: false,
      })
      .select("id")
      .single();

    if (leadErr || !leadRow) {
      return NextResponse.json({ error: leadErr?.message ?? "Falha ao salvar lead" }, { status: 500 });
    }

    await registrarEvento({
      tipo_evento: "lead_criado",
      origem: ORIGEM,
      pagina: request.headers.get("referer") ?? "/",
      lead_id: leadRow.id,
    });

    const whatsappOrigem =
      (await resolveWhatsappOrigem(ORIGEM)) ?? (await resolveWhatsappOrigem("simulador_consorcio"));

    return NextResponse.json({ ok: true, leadId: leadRow.id, whatsappOrigem });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
