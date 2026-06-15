import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarEvento } from "@/lib/eventos/registrar";
import { DEFAULT_LEADS, getConfigJsonPublic } from "@/server/config";

type Body = {
  nome: string;
  whatsapp: string;
  cidade?: string;
  email?: string;
  modo: "consorcio" | "financiamento";
  tipoBem?: "imovel" | "automovel";
  acao: "analise" | "proposta" | "especialista";
  entrada: Record<string, unknown>;
  resultado: Record<string, unknown>;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.nome?.trim() || !body.whatsapp?.trim()) {
      return NextResponse.json({ error: "Nome e WhatsApp obrigatórios" }, { status: 400 });
    }

    const admin = createAdminClient();
    const leadsConfig = await getConfigJsonPublic("leads", DEFAULT_LEADS);
    const origem =
      body.modo === "financiamento" ? "simulador_financiamento" : "simulador_consorcio";

    const valorSim =
      Number(body.entrada.valorCredito ?? body.entrada.valorBem ?? 0) || null;
    const prazo = Number(body.entrada.prazoMeses ?? 0) || null;
    const entradaVal = Number(body.entrada.entrada ?? 0) || null;

    const { data: leadRow, error: leadErr } = await admin
      .from("leads")
      .insert({
        nome: body.nome.trim(),
        whatsapp: body.whatsapp.trim(),
        email: body.email?.trim() || null,
        cidade: body.cidade?.trim() || null,
        origem,
        origem_detalhe: body.acao,
        tipo_interesse: body.modo === "financiamento" ? "financiamento" : "consorcio",
        produto_interesse: body.tipoBem ?? null,
        valor_simulado: valorSim,
        prazo_simulado: prazo,
        entrada: entradaVal,
        dados_simulacao: {
          modo: body.modo,
          tipoBem: body.tipoBem,
          entrada: body.entrada,
          resultado: body.resultado,
        },
        resultado_resumido: JSON.stringify(body.resultado).slice(0, 500),
        status: leadsConfig.statusInicialPadrao,
        criado_manual: false,
      })
      .select("id")
      .single();

    if (leadErr || !leadRow) {
      return NextResponse.json({ error: leadErr?.message ?? "Lead falhou" }, { status: 500 });
    }

    const leadId = leadRow.id;
    let propostaId: string | null = null;

    if (body.acao === "proposta") {
      const parcela = Number(
        (body.resultado as { parcelaEstimada?: number }).parcelaEstimada ??
          (body.resultado as { consorcio?: { parcelaEstimada?: number } }).consorcio
            ?.parcelaEstimada ??
          0,
      );
      const { data: prop } = await admin
        .from("propostas")
        .insert({
          lead_id: leadId,
          nome_cliente: body.nome.trim(),
          whatsapp_cliente: body.whatsapp.trim(),
          cidade_cliente: body.cidade?.trim() || null,
          tipo_proposta:
            body.modo === "financiamento" ? "Financiamento" : "Consórcio — Simulador",
          tipo_bem: body.tipoBem === "imovel" ? "Imóvel" : body.tipoBem === "automovel" ? "Automóvel" : null,
          valor_credito: valorSim,
          prazo: prazo,
          entrada: entradaVal,
          valor_parcela: parcela || null,
          dados_simulacao: body.entrada,
          comparativo_financiamento: body.resultado,
          status: "Gerada",
          pdf_url: null,
        })
        .select("id")
        .single();
      propostaId = prop?.id ?? null;
      if (propostaId) {
        const { enrichPropostaProjecaoFromSimulacao, generateAndStorePropostaPdf } = await import(
          "@/lib/proposta/generate-pdf"
        );
        await enrichPropostaProjecaoFromSimulacao(propostaId);
        const pdf = await generateAndStorePropostaPdf(propostaId, {
          origem,
          pagina: "/simulador",
        });
        await registrarEvento({
          tipo_evento: "lead_criado",
          origem,
          pagina: "/simulador",
          lead_id: leadId,
          dados_evento: { acao: body.acao, modo: body.modo },
        });
        await registrarEvento({
          tipo_evento: "clique_gerar_proposta",
          origem,
          lead_id: leadId,
          entidade_id: propostaId,
        });
        const { data: waOrigem } = await admin
          .from("whatsapp_origens")
          .select("*")
          .eq("origem", "proposta")
          .eq("ativo", true)
          .maybeSingle();
        return NextResponse.json({
          ok: true,
          leadId,
          propostaId,
          pdfDownloadUrl: pdf.signedUrl,
          pdfPath: `/api/propostas/${propostaId}/pdf`,
          whatsappOrigem: waOrigem,
        });
      }
    }

    const { data: waOrigem } = await admin
      .from("whatsapp_origens")
      .select("*")
      .eq("origem", origem)
      .eq("ativo", true)
      .maybeSingle();

    await registrarEvento({
      tipo_evento: "lead_criado",
      origem,
      pagina: "/simulador",
      lead_id: leadId,
      dados_evento: { acao: body.acao, modo: body.modo },
    });
    if (body.acao === "proposta") {
      await registrarEvento({
        tipo_evento: "clique_gerar_proposta",
        origem,
        lead_id: leadId,
        entidade_id: propostaId ?? undefined,
      });
    }

    return NextResponse.json({
      ok: true,
      leadId,
      propostaId,
      whatsappOrigem: waOrigem,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
