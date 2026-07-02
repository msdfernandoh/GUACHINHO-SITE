import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarEvento } from "@/lib/eventos/registrar";
import { DEFAULT_LEADS, getConfigJsonPublic } from "@/server/config";
import { TIPOS_CREDITO_PUBLICO, type TipoCreditoPublico } from "@/lib/leads/tipo-credito";

type Indicado = {
  nome: string;
  whatsapp: string;
  tipoCredito?: string;
  valorCredito?: number | string | null;
  observacao?: string | null;
};

type Body = {
  indicadorNome: string;
  indicadorEmpresa?: string | null;
  indicados: Indicado[];
};

const ORIGEM = "indicacao";

function parseValor(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.indicadorNome?.trim()) {
      return NextResponse.json({ error: "Informe quem indicou" }, { status: 400 });
    }
    if (!Array.isArray(body.indicados) || body.indicados.length === 0) {
      return NextResponse.json({ error: "Inclua ao menos um indicado" }, { status: 400 });
    }

    const admin = createAdminClient();
    const leadsConfig = await getConfigJsonPublic("leads", DEFAULT_LEADS);
    const leadIds: string[] = [];

    for (const ind of body.indicados) {
      if (!ind.nome?.trim() || !ind.whatsapp?.trim()) {
        return NextResponse.json({ error: "Cada indicado precisa de nome e telefone" }, { status: 400 });
      }
      const tipoCredito = ind.tipoCredito?.trim() || null;
      if (tipoCredito && !TIPOS_CREDITO_PUBLICO.includes(tipoCredito as TipoCreditoPublico)) {
        return NextResponse.json({ error: "Tipo de crédito inválido" }, { status: 400 });
      }
      const valorCredito = parseValor(ind.valorCredito);

      const { data: leadRow, error: leadErr } = await admin
        .from("leads")
        .insert({
          nome: ind.nome.trim(),
          whatsapp: ind.whatsapp.trim(),
          email: null,
          origem: ORIGEM,
          origem_detalhe: body.indicadorEmpresa?.trim() || null,
          parceiro_indicador_nome: body.indicadorNome.trim(),
          parceiro_indicador_empresa: body.indicadorEmpresa?.trim() || null,
          tipo_interesse: tipoCredito ?? "outro",
          tipo_credito: tipoCredito,
          valor_credito: valorCredito,
          valor_estimado: valorCredito,
          valor_simulado: valorCredito,
          observacao_indicacao: ind.observacao?.trim() || null,
          observacoes: ind.observacao?.trim() || null,
          status: leadsConfig.statusInicialPadrao ?? "Novo",
          criado_manual: false,
        })
        .select("id")
        .single();

      if (leadErr || !leadRow) {
        return NextResponse.json({ error: leadErr?.message ?? "Falha ao salvar indicação" }, { status: 500 });
      }
      leadIds.push(leadRow.id);
      await registrarEvento({
        tipo_evento: "lead_criado",
        origem: ORIGEM,
        pagina: "/indicar",
        lead_id: leadRow.id,
        dados_evento: { indicador: body.indicadorNome.trim() },
      });
    }

    return NextResponse.json({ ok: true, leadIds, count: leadIds.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
