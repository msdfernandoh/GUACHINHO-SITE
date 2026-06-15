import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarEvento } from "@/lib/eventos/registrar";
import {
  calcularTotaisGrupos,
  grupoToParametros,
} from "@/lib/grupos/calculos";
import type { GrupoConsorcio, GrupoCota } from "@/lib/types";
import { DEFAULT_LEADS, getConfigJsonPublic } from "@/server/config";

type SelecaoPayload = {
  grupoId: string;
  cotaId: string;
};

type Body = {
  nome: string;
  whatsapp: string;
  selecoes: SelecaoPayload[];
  acao: "simulacao" | "proposta" | "especialista";
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.nome?.trim() || !body.whatsapp?.trim() || !body.selecoes?.length) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    const admin = createAdminClient();
    const leadsConfig = await getConfigJsonPublic("leads", DEFAULT_LEADS);
    const whatsapp = body.whatsapp.trim();

    const { data: leadRow, error: leadErr } = await admin
      .from("leads")
      .insert({
        nome: body.nome.trim(),
        whatsapp,
        origem: "grupos",
        origem_detalhe: body.acao,
        tipo_interesse: "consorcio",
        status: leadsConfig.statusInicialPadrao,
        criado_manual: false,
      })
      .select("id")
      .single();

    if (leadErr || !leadRow) {
      return NextResponse.json({ error: leadErr?.message ?? "Lead falhou" }, { status: 500 });
    }

    const leadId = leadRow.id;

    const grupoIds = [...new Set(body.selecoes.map((s) => s.grupoId))];
    const cotaIds = body.selecoes.map((s) => s.cotaId);

    const [{ data: grupos }, { data: cotas }] = await Promise.all([
      admin.from("grupos_consorcio").select("*").in("id", grupoIds),
      admin.from("grupos_cotas").select("*").in("id", cotaIds),
    ]);

    const grupoMap = new Map((grupos ?? []).map((g) => [g.id, g as GrupoConsorcio]));
    const cotaMap = new Map((cotas ?? []).map((c) => [c.id, c as GrupoCota]));

    const selecoesCalc = body.selecoes.map((s) => {
      const grupo = grupoMap.get(s.grupoId)!;
      const cota = cotaMap.get(s.cotaId)!;
      return {
        linha: {
          valorCredito: Number(cota.valor_credito),
          saldoDevedorInformado: cota.saldo_devedor,
          valorParcelaInformado: cota.valor_parcela ?? cota.parcela_com_seguro,
          quantidadeCotas: 1,
        },
        params: grupoToParametros(grupo),
        grupo,
        cota,
      };
    });

    const totais = calcularTotaisGrupos(
      selecoesCalc.map(({ linha, params }) => ({ linha, params })),
    );

    const { data: sim, error: simErr } = await admin
      .from("simulacoes_grupos")
      .insert({
        lead_id: leadId,
        origem: "grupos",
        modalidade: selecoesCalc.map((s) => s.grupo.modalidade).join(", "),
        dados_totais: totais,
        credito_liquido: totais.creditoLiquido,
        total_grupos: grupoIds.length,
        total_cotas: body.selecoes.length,
        total_credito: totais.somaCotas,
        total_saldo_devedor: totais.saldoDevedor,
        total_lance_embutido: totais.lanceEmbutido,
        total_recurso_proprio: totais.recursoProprio,
        total_lance: totais.lanceTotal,
        total_primeira_parcela: totais.primeiraParcela,
        total_seguro: totais.seguro,
        total_parcelas_restantes: totais.parcelasRestantes,
      })
      .select("id")
      .single();

    if (simErr || !sim) {
      return NextResponse.json({ error: simErr?.message ?? "Simulação falhou" }, { status: 500 });
    }

    await admin.from("simulacoes_grupos_itens").insert(
      selecoesCalc.map((s) => ({
        simulacao_grupo_id: sim.id,
        grupo_id: s.grupo.id,
        grupo_cota_id: s.cota.id,
        codigo_grupo: s.grupo.codigo_grupo,
        modalidade: s.grupo.modalidade,
        valor_credito: s.cota.valor_credito,
        quantidade_cotas: 1,
        soma_cotas: s.linha.valorCredito,
        saldo_devedor: s.linha.saldoDevedorInformado,
        lance_embutido: calcularTotaisGrupos([{ linha: s.linha, params: s.params }]).lanceEmbutido,
        recurso_proprio: calcularTotaisGrupos([{ linha: s.linha, params: s.params }]).recursoProprio,
        lance_total: calcularTotaisGrupos([{ linha: s.linha, params: s.params }]).lanceTotal,
        primeira_parcela: s.linha.valorParcelaInformado,
        seguro: calcularTotaisGrupos([{ linha: s.linha, params: s.params }]).seguro,
        parcelas_realizadas: s.grupo.parcelas_realizadas,
        prazo_restante: s.grupo.prazo_restante,
        seguro_pos_contemplacao: s.grupo.seguro_pos_contemplacao,
        parcelas_restantes: s.params.prazoRestante ?? s.params.prazoTotal,
        cet_percentual: s.grupo.cet_percentual,
      })),
    );

    let propostaId: string | null = null;
    if (body.acao === "proposta") {
      const { data: prop } = await admin
        .from("propostas")
        .insert({
          lead_id: leadId,
          nome_cliente: body.nome.trim(),
          whatsapp_cliente: whatsapp,
          tipo_proposta: "Consórcio — Grupos",
          valor_credito: totais.somaCotas,
          valor_parcela: totais.primeiraParcela,
          dados_simulacao: { simulacao_grupo_id: sim.id, totais, selecoes: body.selecoes },
          status: "Gerada",
          pdf_url: null,
        })
        .select("id")
        .single();
      propostaId = prop?.id ?? null;
      if (propostaId) {
        await admin.from("simulacoes_grupos").update({ proposta_id: propostaId }).eq("id", sim.id);
        const { enrichPropostaProjecaoFromSimulacao, generateAndStorePropostaPdf } = await import(
          "@/lib/proposta/generate-pdf"
        );
        await enrichPropostaProjecaoFromSimulacao(propostaId);
        const pdf = await generateAndStorePropostaPdf(propostaId, {
          origem: "grupos",
          pagina: "/grupos",
        });
        await registrarEvento({
          tipo_evento: "lead_criado",
          origem: "grupos",
          pagina: "/grupos",
          lead_id: leadId,
        });
        await registrarEvento({
          tipo_evento: "simulacao_grupo_criada",
          origem: "grupos",
          entidade_tipo: "simulacao_grupo",
          entidade_id: sim.id,
          lead_id: leadId,
          dados_evento: { acao: body.acao },
        });
        await registrarEvento({
          tipo_evento: "clique_gerar_proposta",
          origem: "grupos",
          lead_id: leadId,
          entidade_id: propostaId,
        });
        return NextResponse.json({
          ok: true,
          leadId,
          simulacaoId: sim.id,
          propostaId,
          creditoLiquido: totais.creditoLiquido,
          pdfDownloadUrl: pdf.signedUrl,
          pdfPath: `/api/propostas/${propostaId}/pdf`,
        });
      }
    }

    await registrarEvento({
      tipo_evento: "lead_criado",
      origem: "grupos",
      pagina: "/grupos",
      lead_id: leadId,
    });
    await registrarEvento({
      tipo_evento: "simulacao_grupo_criada",
      origem: "grupos",
      entidade_tipo: "simulacao_grupo",
      entidade_id: sim.id,
      lead_id: leadId,
      dados_evento: { acao: body.acao },
    });
    if (body.acao === "proposta") {
      await registrarEvento({
        tipo_evento: "clique_gerar_proposta",
        origem: "grupos",
        lead_id: leadId,
        entidade_id: propostaId ?? undefined,
      });
    }

    return NextResponse.json({
      ok: true,
      leadId,
      simulacaoId: sim.id,
      propostaId,
      creditoLiquido: totais.creditoLiquido,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
