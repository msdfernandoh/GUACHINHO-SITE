import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarEvento } from "@/lib/eventos/registrar";
import {
  calcularLinhaSimulacaoGrupo,
  agregarResultadosLinhas,
  buildSnapshotLanceLinha,
  resolveModalidadeLanceAtiva,
  listarModalidadesLanceAtivas,
  type ConfigLinhaSimulacaoGrupo,
} from "@/lib/grupos/simulacao-linha";
import { fatorSeguroGrupo } from "@/lib/grupos/seguro";
import type { GrupoConsorcio, GrupoCota, GrupoModalidadeLance } from "@/lib/types";
import { DEFAULT_LEADS, getConfigJsonPublic } from "@/server/config";

type SelecaoPayload = {
  grupoId: string;
  cotaId: string;
  config: ConfigLinhaSimulacaoGrupo;
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

    const [{ data: grupos }, { data: cotas }, { data: modalidades }] = await Promise.all([
      admin.from("grupos_consorcio").select("*").in("id", grupoIds),
      admin.from("grupos_cotas").select("*").in("id", cotaIds),
      admin.from("grupos_modalidades_lance").select("*").in("grupo_id", grupoIds),
    ]);

    const grupoMap = new Map((grupos ?? []).map((g) => [g.id, g as GrupoConsorcio]));
    const cotaMap = new Map((cotas ?? []).map((c) => [c.id, c as GrupoCota]));
    const modsByGrupo = new Map<string, GrupoModalidadeLance[]>();
    (modalidades ?? []).forEach((m) => {
      const list = modsByGrupo.get(m.grupo_id) ?? [];
      list.push(m as GrupoModalidadeLance);
      modsByGrupo.set(m.grupo_id, list);
    });

    const selecoesCalc = body.selecoes.map((s) => {
      const grupo = grupoMap.get(s.grupoId)!;
      const cota = cotaMap.get(s.cotaId)!;
      const mods = modsByGrupo.get(s.grupoId) ?? [];
      const resultado = calcularLinhaSimulacaoGrupo({
        grupo,
        cota,
        config: s.config,
        modalidades: mods,
      });
      return { grupo, cota, config: s.config, resultado, mods };
    });

    const totais = agregarResultadosLinhas(selecoesCalc.map((s) => s.resultado));
    const totalCotas = selecoesCalc.reduce((a, s) => a + s.resultado.quantidadeCotas, 0);

    const { data: sim, error: simErr } = await admin
      .from("simulacoes_grupos")
      .insert({
        lead_id: leadId,
        origem: "grupos",
        modalidade: selecoesCalc.map((s) => s.grupo.modalidade).join(", "),
        dados_totais: totais,
        credito_liquido: totais.creditoLiquido,
        total_grupos: grupoIds.length,
        total_cotas: totalCotas,
        total_credito: totais.somaCotas,
        total_saldo_devedor: totais.saldoDevedorFinal,
        total_lance_embutido: totais.lanceEmbutido,
        total_recurso_proprio: totais.recursoProprio,
        total_lance: totais.lanceTotal,
        total_primeira_parcela: totais.primeiraParcela,
        total_seguro: totais.seguroTotal,
        total_parcelas_restantes: selecoesCalc[0]?.resultado.parcelasRestantesPosContemplacao ?? 0,
      })
      .select("id")
      .single();

    if (simErr || !sim) {
      return NextResponse.json({ error: simErr?.message ?? "Simulação falhou" }, { status: 500 });
    }

    await admin.from("simulacoes_grupos_itens").insert(
      selecoesCalc.map((s) => {
        const modsAtivas = listarModalidadesLanceAtivas(s.grupo, s.mods);
        const mod = resolveModalidadeLanceAtiva(s.config, modsAtivas);
        const lanceSnapshot = buildSnapshotLanceLinha(s.config, s.resultado, mod);
        return {
        simulacao_grupo_id: sim.id,
        grupo_id: s.grupo.id,
        grupo_cota_id: s.cota.id,
        codigo_grupo: s.grupo.codigo_grupo,
        modalidade: s.grupo.modalidade,
        valor_credito: s.cota.valor_credito,
        quantidade_cotas: s.resultado.quantidadeCotas,
        soma_cotas: s.resultado.somaCotas,
        saldo_devedor: s.resultado.saldoDevedorInicial,
        saldo_devedor_inicial: s.resultado.saldoDevedorInicial,
        saldo_devedor_final: s.resultado.saldoDevedorFinal,
        lance_embutido: s.resultado.lanceEmbutido,
        recurso_proprio: s.resultado.recursoProprio,
        lance_total: s.resultado.lanceTotal,
        primeira_parcela: s.resultado.primeiraParcela,
        seguro: s.resultado.seguroMensal,
        parcelas_realizadas: s.grupo.parcelas_realizadas,
        prazo_restante: s.grupo.prazo_restante,
        seguro_pos_contemplacao: s.config.usaSeguro,
        parcelas_restantes: s.resultado.parcelasRestantesPosContemplacao,
        cet_percentual: s.grupo.cet_percentual,
        modalidade_parcela: s.config.modalidadeParcela,
        usa_lance_embutido: s.config.usaLanceEmbutido,
        modalidade_lance_id: s.config.modalidadeLanceId?.startsWith("fallback-")
          ? null
          : s.config.modalidadeLanceId,
        percentual_lance_embutido: s.resultado.percentualLanceEmbutido,
        usa_recurso_proprio: s.config.usaRecursoProprio,
        recurso_proprio_tipo: s.config.recursoProprioModo,
        recurso_proprio_valor: s.resultado.recursoProprio,
        usa_seguro: s.config.usaSeguro,
        percentual_seguro: fatorSeguroGrupo(s.grupo.seguro_percentual),
        parcela_pos_contemplacao: s.resultado.parcelaPosContemplacao,
        credito_liquido: s.resultado.creditoLiquido,
        dados_linha: {
          config: s.config,
          resultado: s.resultado,
          ...lanceSnapshot,
        },
      };
      }),
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
          dados_simulacao: {
            simulacao_grupo_id: sim.id,
            totais,
            selecoes: selecoesCalc.map((s) => {
              const modsAtivas = listarModalidadesLanceAtivas(s.grupo, s.mods);
              const mod = resolveModalidadeLanceAtiva(s.config, modsAtivas);
              return {
                grupoId: s.grupo.id,
                codigoGrupo: s.grupo.codigo_grupo,
                cotaId: s.cota.id,
                credito: s.cota.valor_credito,
                config: s.config,
                resultado: s.resultado,
                ...buildSnapshotLanceLinha(s.config, s.resultado, mod),
              };
            }),
          },
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
