import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarEvento } from "@/lib/eventos/registrar";
import {
  DEFAULT_CALCULADORAS_FINANCEIRAS,
  DEFAULT_CONTATO,
  DEFAULT_LEADS,
  getConfigJsonPublic,
} from "@/server/config";
import { resolveWhatsappOrigem } from "@/lib/whatsapp/resolve-origem";
import { labelCalculadora } from "@/lib/calculadoras/whatsapp-messages";
import type { CalculadoraId } from "@/lib/calculadoras/types";

type Body = {
  nome: string;
  whatsapp: string;
  cidade?: string;
  email?: string;
  calculadoraId: CalculadoraId;
  acao: "analise" | "especialista";
  inputs: Record<string, unknown>;
  resultado: Record<string, unknown>;
};

const ORIGEM = "calculadora_financeira";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.nome?.trim() || !body.whatsapp?.trim() || !body.calculadoraId) {
      return NextResponse.json({ error: "Nome, WhatsApp e calculadora obrigatórios" }, { status: 400 });
    }

    const admin = createAdminClient();
    const [leadsConfig, calcConfig] = await Promise.all([
      getConfigJsonPublic("leads", DEFAULT_LEADS),
      getConfigJsonPublic("calculadoras_financeiras", DEFAULT_CALCULADORAS_FINANCEIRAS),
    ]);

    const tipoInteresse =
      body.calculadoraId === "juros_real" ? "juros_real" : labelCalculadora(body.calculadoraId);

    const dadosSimulacaoBase = {
      calculadoraId: body.calculadoraId,
      inputs: body.inputs,
      resultado: body.resultado,
    };

    const resultado = body.resultado as Record<string, unknown>;
    let dados_simulacao: Record<string, unknown> = dadosSimulacaoBase;

    if (resultado.tipo_calculadora === "correcao_aluguel") {
      dados_simulacao = {
        tipo_calculadora: "correcao_aluguel",
        valor_atual: resultado.valorAtual,
        indice: resultado.indice,
        percentual_aplicado: resultado.percentualAplicado,
        novo_valor: resultado.novoValor,
        data_referencia_indice: resultado.data_referencia_indice,
      };
    } else if (
      resultado.tipo_calculadora === "aplicacao_comparativo_consorcio" ||
      resultado.tipo_calculadora === "aplicacao_comparativo"
    ) {
      const lead =
        (resultado.lead as Record<string, unknown> | undefined) ??
        (resultado.tipo_calculadora === "aplicacao_comparativo_consorcio" ? resultado : null);
      dados_simulacao =
        lead && typeof lead === "object" && "tipo_calculadora" in lead
          ? lead
          : {
              tipo_calculadora: "aplicacao_comparativo",
              valor_inicial: body.inputs.valorInicial,
              aporte_mensal: body.inputs.aporteMensal,
              prazo_meses: body.inputs.prazoMeses,
              opcoes_comparadas: body.inputs.opcoes_comparadas,
              melhor_resultado_estimado: resultado.melhorResultadoEstimado,
            };
    } else if (resultado.tipo_calculadora === "juros_real") {
      dados_simulacao = {
        tipo_calculadora: "juros_real",
        inputs: body.inputs,
        resultado,
      };
    }

    const valorSim =
      Number(body.inputs.valorInicial ?? body.inputs.valorAtual ?? body.inputs.valorBem ?? 0) || null;
    const prazo = Number(body.inputs.prazoMeses ?? 0) || null;
    const entradaVal = Number(body.inputs.entrada ?? 0) || null;
    const valorCreditoLead =
      body.calculadoraId === "juros_real" && resultado.ok
        ? Number(resultado.valorFinanciado ?? valorSim)
        : valorSim;

    const { data: leadRow, error: leadErr } = await admin
      .from("leads")
      .insert({
        nome: body.nome.trim(),
        whatsapp: body.whatsapp.trim(),
        email: body.email?.trim() || null,
        cidade: body.cidade?.trim() || null,
        origem: ORIGEM,
        origem_detalhe: body.acao,
        tipo_interesse: tipoInteresse,
        produto_interesse: "análise financeira",
        valor_credito: valorCreditoLead,
        valor_simulado: valorSim,
        prazo_simulado: prazo,
        entrada: entradaVal,
        dados_simulacao,
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
    const origemKey = calcConfig.whatsappOrigem?.trim() || ORIGEM;
    let whatsappOrigem = await resolveWhatsappOrigem(origemKey);
    if (!whatsappOrigem) {
      whatsappOrigem = await resolveWhatsappOrigem(ORIGEM);
    }
    if (!whatsappOrigem) {
      const contato = await getConfigJsonPublic("contato", DEFAULT_CONTATO);
      const tel = contato.whatsappPrincipal?.trim();
      if (tel) {
        whatsappOrigem = {
          origem: ORIGEM,
          ativo: true,
          exibir_botao_apos_lead: true,
          nome_atendimento: null,
          whatsapp_destino: tel,
          mensagem_padrao: null,
          usar_whatsapp_principal_fallback: true,
        };
      }
    }

    await registrarEvento({
      tipo_evento: "lead_criado",
      origem: ORIGEM,
      pagina: "/calculadoras",
      lead_id: leadId,
      dados_evento: { calculadoraId: body.calculadoraId, acao: body.acao },
    });

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
