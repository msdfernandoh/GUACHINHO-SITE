import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_LEADS, getConfigJsonPublic } from "@/server/config";
import { TIPOS_CREDITO_PUBLICO, type TipoCreditoPublico } from "@/lib/leads/tipo-credito";
import { registrarEvento } from "@/lib/eventos/registrar";

type Body = {
  nome: string;
  whatsapp: string;
  tipoCredito?: string;
  valorCredito?: number | string | null;
  observacao?: string;
  sessionId?: string;
  paginaOrigem?: string;
};

const ORIGEM = "ia_chat_fallback";

function parseValor(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.nome?.trim() || !body.whatsapp?.trim()) {
      return NextResponse.json({ error: "Nome e WhatsApp são obrigatórios" }, { status: 400 });
    }
    const tipoCredito = body.tipoCredito?.trim() || null;
    if (tipoCredito && !TIPOS_CREDITO_PUBLICO.includes(tipoCredito as TipoCreditoPublico)) {
      return NextResponse.json({ error: "Tipo de crédito inválido" }, { status: 400 });
    }

    const valorCredito = parseValor(body.valorCredito);
    const admin = createAdminClient();
    const leadsConfig = await getConfigJsonPublic("leads", DEFAULT_LEADS);
    const pagina = body.paginaOrigem ?? "/";

    const { data: leadRow, error } = await admin
      .from("leads")
      .insert({
        nome: body.nome.trim(),
        whatsapp: body.whatsapp.trim(),
        origem: ORIGEM,
        origem_detalhe: pagina,
        tipo_interesse: tipoCredito ?? "outro",
        tipo_credito: tipoCredito,
        valor_credito: valorCredito,
        valor_estimado: valorCredito,
        valor_simulado: valorCredito,
        observacoes: body.observacao?.trim() || "Assistente em modo fallback sem IA.",
        dados_simulacao: {
          sessionId: body.sessionId,
          modo: "fallback_form",
          pagina_origem: pagina,
        },
        status: leadsConfig.statusInicialPadrao ?? "Novo",
        criado_manual: false,
      })
      .select("id")
      .single();

    if (error || !leadRow) {
      console.error("[ia/fallback-lead]", error?.message);
      return NextResponse.json({ error: error?.message ?? "Falha ao salvar" }, { status: 500 });
    }

    await registrarEvento({
      tipo_evento: "lead_criado",
      origem: ORIGEM,
      pagina,
      lead_id: leadRow.id,
    });

    return NextResponse.json({ ok: true, leadId: leadRow.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
