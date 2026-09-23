import type { PropostaPdfData, MarcoProjecaoPdf, GrupoCotaPdfRow } from "./pdf/types";
import { fmtDateBr, fmtMoney } from "./pdf/format";
import { construirSegmentos, type ItemGrupoRow } from "./pdf/build-segmentos";
import {
  calcularLinhaSimulacaoGrupo,
  type ConfigLinhaSimulacaoGrupo,
} from "@/lib/grupos/simulacao-linha";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_PROPOSTAS,
  DEFAULT_SITE,
  DEFAULT_CONTATO,
  getConfigJsonPublic,
} from "@/server/config";
import type { PropostasConfig } from "@/lib/config/defaults";
import { gerarProjecaoAnoAno, resumoProjecaoAnos } from "@/lib/simulador/projecao";
import type { EntradaConsorcio } from "@/lib/simulador/consorcio";
import type { GrupoConsorcio, GrupoCota, GrupoModalidadeLance } from "@/lib/types";

type PropostaRow = Record<string, unknown>;

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function resolveValidadeTexto(p: PropostaRow, validadePadraoDias: number): string | null {
  if (p.validade_data) {
    return fmtDateBr(String(p.validade_data));
  }
  const dias = num(p.validade_dias) ?? validadePadraoDias;
  if (!dias) return null;
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return fmtDateBr(d.toISOString());
}

function buildMarcosFromConsorcio(entrada: EntradaConsorcio, prazoMeses: number): MarcoProjecaoPdf[] {
  const linhas = gerarProjecaoAnoAno(entrada);
  const anosPrazo = Math.ceil(prazoMeses / 12);
  const marcosAnos = [1, 3, 5, 10].filter((a) => a <= anosPrazo);
  if (anosPrazo > 0 && !marcosAnos.includes(anosPrazo)) {
    marcosAnos.push(anosPrazo);
  }
  marcosAnos.sort((a, b) => a - b);
  return resumoProjecaoAnos(linhas, marcosAnos).map((l) => ({
    periodo: l.ano === anosPrazo && l.ano >= 10 ? `${l.ano} anos (final)` : `${l.ano} ${l.ano === 1 ? "ano" : "anos"}`,
    totalPago: l.totalPagoAcumulado,
    creditoReajustado: l.creditoEstimadoReajustado,
    valorizacao: l.valorizacaoAcumuladaCredito,
    ganhoPatrimonial: l.ganhoPatrimonialEstimado,
  }));
}

export async function buildPropostaPdfData(
  propostaId: string,
  overrides?: {
    consultor_nome?: string;
    consultor_telefone?: string;
    consultor_email?: string;
    parceiro_nome?: string;
    validade_dias?: number;
    validade_data?: string;
    observacao?: string;
    visualizacao?: "completa" | "resumida";
  },
): Promise<PropostaPdfData> {
  const admin = createAdminClient();
  const { data: proposta, error } = await admin
    .from("propostas")
    .select("*")
    .eq("id", propostaId)
    .single();
  if (error || !proposta) throw new Error(error?.message ?? "Proposta não encontrada");

  const p = proposta as PropostaRow;
  const [site, contato, propostasCfg] = await Promise.all([
    getConfigJsonPublic("site", DEFAULT_SITE),
    getConfigJsonPublic("contato", DEFAULT_CONTATO),
    getConfigJsonPublic("propostas", DEFAULT_PROPOSTAS),
  ]);

  const dadosSim = (p.dados_simulacao ?? {}) as Record<string, unknown>;
  const comparativoRaw = (p.comparativo_financiamento ?? dadosSim.comparativo ?? null) as Record<
    string,
    unknown
  > | null;

  let gruposCotas: GrupoCotaPdfRow[] = [];
  let gruposTotais: PropostaPdfData["gruposTotais"] = null;
  let segmentos: PropostaPdfData["segmentos"] = [];
  let consolidado: PropostaPdfData["consolidado"] = null;

  const simGrupoId = dadosSim.simulacao_grupo_id as string | undefined;
  const rawSelecoes = Array.isArray(dadosSim.selecoes) ? dadosSim.selecoes : null;

  if (simGrupoId) {
    const { data: itens } = await admin
      .from("simulacoes_grupos_itens")
      .select("*")
      .eq("simulacao_grupo_id", simGrupoId);

    const grupoIds = [
      ...new Set(((itens ?? []) as Array<{ grupo_id: string | null }>).map((i) => i.grupo_id).filter((id): id is string => !!id)),
    ];
    const cotaIds = [
      ...new Set(
        ((itens ?? []) as Array<{ grupo_cota_id?: string | null }>)
          .map((i) => i.grupo_cota_id)
          .filter((id): id is string => !!id),
      ),
    ];
    let itensAtuais = (itens ?? []) as ItemGrupoRow[];
    if (grupoIds.length > 0) {
      const [{ data: grupos }, { data: mods }, { data: cotas }] = await Promise.all([
        admin.from("grupos_consorcio").select("*").in("id", grupoIds),
        admin.from("grupos_modalidades_lance").select("*").in("grupo_id", grupoIds).eq("ativo", true),
        cotaIds.length > 0
          ? admin.from("grupos_cotas").select("*").in("id", cotaIds)
          : Promise.resolve({ data: [] }),
      ]);
      const gruposById = new Map<string, GrupoConsorcio>(
        ((grupos ?? []) as GrupoConsorcio[]).map((g) => [g.id, g]),
      );
      const modsByGrupo = new Map<string, GrupoModalidadeLance[]>();
      for (const m of (mods ?? []) as GrupoModalidadeLance[]) {
        const list = modsByGrupo.get(m.grupo_id) ?? [];
        list.push(m);
        modsByGrupo.set(m.grupo_id, list);
      }
      const cotasById = new Map<string, GrupoCota>(
        ((cotas ?? []) as GrupoCota[]).map((cota) => [cota.id, cota]),
      );

      // A simulação salva a estratégia escolhida, não os valores financeiros imutáveis.
      // Ao emitir uma proposta, reaplica a estratégia ao catálogo vigente para que uma
      // taxa do grupo alterada não mantenha parcela/totais antigos no PDF.
      itensAtuais = ((itens ?? []) as Array<ItemGrupoRow & { grupo_cota_id?: string | null }>).map((item) => {
        const grupo = item.grupo_id ? gruposById.get(item.grupo_id) : undefined;
        const cota = item.grupo_cota_id ? cotasById.get(item.grupo_cota_id) : undefined;
        const dadosLinha = (item.dados_linha ?? {}) as Record<string, unknown>;
        const config = dadosLinha.config as ConfigLinhaSimulacaoGrupo | undefined;
        if (!grupo || !cota || !config) return item;
        const configAtual: ConfigLinhaSimulacaoGrupo = {
          ...config,
          cotaId: config.cotaId ?? item.grupo_cota_id ?? cota.id,
        };

        const resultado = calcularLinhaSimulacaoGrupo({
          grupo,
          cota,
          config: configAtual,
          modalidades: modsByGrupo.get(grupo.id) ?? [],
        });
        if (!resultado.ativo) return item;

        return {
          ...item,
          codigo_grupo: grupo.codigo_grupo,
          modalidade: grupo.modalidade,
          valor_credito: cota.valor_credito,
          quantidade_cotas: resultado.quantidadeCotas,
          saldo_devedor: resultado.saldoDevedorInicial,
          primeira_parcela: resultado.primeiraParcela,
          lance_embutido: resultado.lanceEmbutido,
          recurso_proprio: resultado.recursoProprio,
          lance_total: resultado.lanceTotal,
          parcela_pos_contemplacao: resultado.parcelaPosContemplacao,
          credito_liquido: resultado.creditoLiquido,
          parcelas_realizadas: grupo.parcelas_realizadas,
          prazo_restante: resultado.parcelasRestantesPosContemplacao,
          dados_linha: { ...dadosLinha, config: configAtual, resultado },
        } satisfies ItemGrupoRow;
      });
      const built = construirSegmentos(
        itensAtuais,
        gruposById,
        modsByGrupo,
      );
      segmentos = built.segmentos;
      consolidado = built.consolidado;
    }

    gruposCotas = itensAtuais.map((it) => {
      const dadosLinha = (it.dados_linha ?? {}) as Record<string, unknown>;
      const modLance = dadosLinha.modalidade_lance as { nome?: string } | null | undefined;
      return {
        codigoGrupo: String(it.codigo_grupo ?? ""),
        modalidade: String(it.modalidade ?? ""),
        valorCredito: num(it.valor_credito) ?? 0,
        parcela: num(it.primeira_parcela) ?? 0,
        saldoDevedor: num(it.saldo_devedor) ?? 0,
        lanceEmbutido: num(it.lance_embutido) ?? 0,
        recursoProprio: num(it.recurso_proprio) ?? 0,
        lanceTotal: num(it.lance_total) ?? 0,
        seguro: num(it.seguro) ?? 0,
        prazoRestante: it.parcelas_restantes ?? "—",
        modalidadeLanceNome: modLance?.nome ? String(modLance.nome) : null,
        parcelaPosContemplacao: num(it.parcela_pos_contemplacao),
        creditoLiquido: num(it.credito_liquido),
      };
    });
    if (consolidado) {
      gruposTotais = {
        creditoTotal: consolidado.credito,
        lanceTotal: consolidado.lanceTotal,
        lanceEmbutido: consolidado.lanceEmbutido,
        recursoProprio: consolidado.recursoProprio,
        primeiraParcela: consolidado.primeiraParcela,
        creditoLiquido: consolidado.creditoLiquido,
      };
    }
  } else if (rawSelecoes && rawSelecoes.length > 0) {
    const selecoes = rawSelecoes as Array<Record<string, any>>;
    const grupoIds = [
      ...new Set(
        selecoes
          .map((s) => s.grupoId || s.grupo?.id || s.grupo_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [{ data: grupos }, { data: mods }] = await Promise.all([
      grupoIds.length > 0
        ? admin.from("grupos_consorcio").select("*").in("id", grupoIds)
        : Promise.resolve({ data: [] }),
      grupoIds.length > 0
        ? admin.from("grupos_modalidades_lance").select("*").in("grupo_id", grupoIds).eq("ativo", true)
        : Promise.resolve({ data: [] }),
    ]);

    const gruposById = new Map<string, GrupoConsorcio>(
      ((grupos ?? []) as GrupoConsorcio[]).map((g) => [g.id, g]),
    );
    const modsByGrupo = new Map<string, GrupoModalidadeLance[]>();
    for (const m of (mods ?? []) as GrupoModalidadeLance[]) {
      const list = modsByGrupo.get(m.grupo_id) ?? [];
      list.push(m);
      modsByGrupo.set(m.grupo_id, list);
    }

    const itens: ItemGrupoRow[] = selecoes.map((s) => {
      const grupoId = String(s.grupoId || s.grupo?.id || s.grupo_id || "");
      const g = gruposById.get(grupoId) ?? (s.grupo as GrupoConsorcio | undefined);
      const res = (s.resultado ?? {}) as Record<string, unknown>;
      const cfg = (s.config ?? {}) as Record<string, unknown>;
      const valCredito = num(res.valorCredito) ?? num(s.credito) ?? num(s.valor_credito) ?? num(p.valor_credito) ?? 0;
      const qtdCotas = Math.max(1, num(cfg.quantidadeCotas) ?? num(res.quantidadeCotas) ?? num(s.quantidade_cotas) ?? 1);
      const taxaAdm = num(g?.taxa_administrativa_percentual) ?? num(p.taxa_administrativa) ?? 20;
      const fundoRes = num(g?.fundo_reserva_percentual) ?? num(p.fundo_reserva) ?? 2;
      const saldoDevedor = num(res.saldoDevedorInicial) ?? num(s.saldoDevedor) ?? (valCredito * qtdCotas * (1 + (taxaAdm + fundoRes) / 100));
      const primeiraParcela = num(res.primeiraParcela) ?? num(s.parcela) ?? num(p.valor_parcela) ?? 0;
      const lanceEmbutido = num(res.lanceEmbutido) ?? num(s.lanceEmbutido) ?? 0;
      const recursoProprio = num(res.recursoProprio) ?? num(s.recursoProprio) ?? 0;
      const lanceTotal = num(res.lanceTotal) ?? (lanceEmbutido + recursoProprio);
      const credLiq = num(res.creditoLiquido) ?? ((valCredito * qtdCotas) - lanceEmbutido);
      const modLanceId = cfg.modalidadeLanceId ? String(cfg.modalidadeLanceId) : null;

      return {
        grupo_id: grupoId || null,
        codigo_grupo: String(g?.codigo_grupo ?? s.codigoGrupo ?? s.codigo_grupo ?? ""),
        modalidade: String(g?.modalidade ?? s.modalidade ?? p.tipo_bem ?? "Consórcio"),
        valor_credito: valCredito,
        quantidade_cotas: qtdCotas,
        saldo_devedor: saldoDevedor,
        primeira_parcela: primeiraParcela,
        lance_embutido: lanceEmbutido,
        recurso_proprio: recursoProprio,
        lance_total: lanceTotal,
        parcela_pos_contemplacao: num(res.parcelaPosContemplacao) ?? null,
        credito_liquido: credLiq,
        parcelas_realizadas: num(g?.parcelas_realizadas) ?? null,
        prazo_restante: num(g?.prazo_restante) ?? num(res.parcelasRestantesPosContemplacao) ?? num(p.prazo) ?? null,
        modalidade_lance_id: modLanceId,
        dados_linha: { config: cfg, resultado: res, ...s },
      };
    });

    const built = construirSegmentos(itens, gruposById, modsByGrupo);
    segmentos = built.segmentos;
    consolidado = built.consolidado;

    gruposCotas = itens.map((it) => ({
      codigoGrupo: it.codigo_grupo ?? "",
      modalidade: it.modalidade ?? "",
      valorCredito: it.valor_credito ?? 0,
      parcela: it.primeira_parcela ?? 0,
      saldoDevedor: it.saldo_devedor ?? 0,
      lanceEmbutido: it.lance_embutido ?? 0,
      recursoProprio: it.recurso_proprio ?? 0,
      lanceTotal: it.lance_total ?? 0,
      seguro: 0,
      prazoRestante: it.prazo_restante ?? "—",
      modalidadeLanceNome: null,
      parcelaPosContemplacao: it.parcela_pos_contemplacao,
      creditoLiquido: it.credito_liquido,
    }));
  } else {
    // Propostas criadas pelo ERP, Admin ou fluxo sem seleções em array
    const targetGrupoId =
      (p.grupo_id as string | undefined) ||
      (dadosSim.grupo_id as string | undefined) ||
      (dadosSim.grupoId as string | undefined) ||
      null;

    let grupoTarget: GrupoConsorcio | null = null;
    let modsTarget: GrupoModalidadeLance[] = [];

    if (targetGrupoId) {
      const [{ data: gData }, { data: mData }] = await Promise.all([
        admin.from("grupos_consorcio").select("*").eq("id", targetGrupoId).maybeSingle(),
        admin.from("grupos_modalidades_lance").select("*").eq("grupo_id", targetGrupoId).eq("ativo", true),
      ]);
      grupoTarget = (gData as GrupoConsorcio) ?? null;
      modsTarget = (mData as GrupoModalidadeLance[]) ?? [];
    }

    const valCredito = num(p.valor_credito) ?? 0;
    const taxaAdm = num(p.taxa_administrativa) ?? num(grupoTarget?.taxa_administrativa_percentual) ?? 20;
    const fundoRes = num(p.fundo_reserva) ?? num(grupoTarget?.fundo_reserva_percentual) ?? 2;
    const prazo = num(p.prazo) ?? num(grupoTarget?.prazo_restante) ?? 180;
    const saldoDevedor = valCredito * (1 + (taxaAdm + fundoRes) / 100);
    const primeiraParcela = num(p.valor_parcela) ?? (saldoDevedor / Math.max(1, prazo));
    const lanceEmbutido = num(dadosSim.lanceEmbutido) ?? 0;
    const recursoProprio = num(p.entrada) ?? num(dadosSim.recursoProprio) ?? 0;
    const lanceTotal = lanceEmbutido + recursoProprio;
    const credLiq = valCredito - lanceEmbutido;

    const grupoResolvido: GrupoConsorcio = grupoTarget ?? {
      id: targetGrupoId || "grupo-padrao-proposta",
      codigo_grupo: String(p.tipo_bem || p.tipo_proposta || "Consórcio"),
      administradora: "Racon Consórcios",
      administradora_id: null,
      modalidade: String(p.tipo_bem || "Imóvel"),
      taxa_administrativa_percentual: taxaAdm,
      fundo_reserva_percentual: fundoRes,
      seguro_habilitado: num(p.seguro_prestamista) != null && num(p.seguro_prestamista)! > 0,
      seguro_percentual: num(p.seguro_prestamista) ?? 0,
      seguro_valor: null,
      tem_parcela_reduzida: false,
      percentual_parcela_reduzida: null,
      permite_lance_embutido: true,
      percentual_lance_embutido: 30,
      percentual_recurso_proprio_sugerido: null,
      prazo_total: prazo,
      prazo_restante: prazo,
      parcelas_realizadas: 0,
      seguro_pos_contemplacao: false,
      cet_percentual: null,
      status: "ativo",
      ativo: true,
      observacoes: null,
      created_at: String(p.created_at ?? new Date().toISOString()),
      updated_at: String(p.updated_at ?? new Date().toISOString()),
    };

    const gruposById = new Map<string, GrupoConsorcio>([[grupoResolvido.id, grupoResolvido]]);
    const modsByGrupo = new Map<string, GrupoModalidadeLance[]>([[grupoResolvido.id, modsTarget]]);

    const item: ItemGrupoRow = {
      grupo_id: grupoResolvido.id,
      codigo_grupo: grupoResolvido.codigo_grupo,
      modalidade: grupoResolvido.modalidade,
      valor_credito: valCredito,
      quantidade_cotas: 1,
      saldo_devedor: saldoDevedor,
      primeira_parcela: primeiraParcela,
      lance_embutido: lanceEmbutido,
      recurso_proprio: recursoProprio,
      lance_total: lanceTotal,
      parcela_pos_contemplacao: num(dadosSim.parcelaPosContemplacao) ?? primeiraParcela,
      credito_liquido: credLiq,
      parcelas_realizadas: num(grupoResolvido.parcelas_realizadas) ?? 0,
      prazo_restante: prazo,
      modalidade_lance_id: null,
      dados_linha: { ...dadosSim },
    };

    const built = construirSegmentos([item], gruposById, modsByGrupo);
    segmentos = built.segmentos;
    consolidado = built.consolidado;

    gruposCotas = [{
      codigoGrupo: item.codigo_grupo ?? "",
      modalidade: item.modalidade ?? "",
      valorCredito: item.valor_credito ?? 0,
      parcela: item.primeira_parcela ?? 0,
      saldoDevedor: item.saldo_devedor ?? 0,
      lanceEmbutido: item.lance_embutido ?? 0,
      recursoProprio: item.recurso_proprio ?? 0,
      lanceTotal: item.lance_total ?? 0,
      seguro: 0,
      prazoRestante: item.prazo_restante ?? "—",
      modalidadeLanceNome: null,
      parcelaPosContemplacao: item.parcela_pos_contemplacao,
      creditoLiquido: item.credito_liquido,
    }];
  }

  const totaisGrupos = dadosSim.totais as Record<string, unknown> | undefined;
  if (gruposTotais == null && totaisGrupos) {
    gruposTotais = {
      creditoTotal: num(totaisGrupos.somaCotas) ?? num(p.valor_credito) ?? 0,
      lanceTotal: num(totaisGrupos.lanceTotal) ?? 0,
      lanceEmbutido: num(totaisGrupos.lanceEmbutido) ?? 0,
      recursoProprio: num(totaisGrupos.recursoProprio) ?? 0,
      primeiraParcela: num(totaisGrupos.primeiraParcela) ?? num(p.valor_parcela) ?? 0,
      creditoLiquido: num(totaisGrupos.creditoLiquido) ?? 0,
    };
  } else if (gruposTotais == null && consolidado) {
    gruposTotais = {
      creditoTotal: consolidado.credito,
      lanceTotal: consolidado.lanceTotal,
      lanceEmbutido: consolidado.lanceEmbutido,
      recursoProprio: consolidado.recursoProprio,
      primeiraParcela: consolidado.primeiraParcela,
      creditoLiquido: consolidado.creditoLiquido,
    };
  }

  const detalhesLinhas: Array<{ label: string; value: string }> = [];
  const tipo = String(p.tipo_proposta ?? "");
  const isFin = tipo.toLowerCase().includes("financiamento");
  const isCarta = tipo.toLowerCase().includes("carta");
  const cartaDados = (dadosSim.carta ?? null) as Record<string, unknown> | null;

  if (isCarta && cartaDados) {
    detalhesLinhas.push(
      { label: "Administradora", value: String(cartaDados.administradora ?? "—") },
      { label: "Valor do crédito", value: fmtMoney(num(p.valor_credito) ?? num(cartaDados.credito)) },
      { label: "Entrada", value: fmtMoney(num(p.entrada) ?? num(cartaDados.entrada)) },
      { label: "Prazo (parcelas)", value: String(num(p.prazo) ?? num(cartaDados.prazo_quantidade) ?? "—") },
      { label: "Parcela", value: fmtMoney(num(p.valor_parcela) ?? num(cartaDados.valor_parcela)) },
      { label: "Saldo devedor", value: fmtMoney(num(cartaDados.saldo_devedor)) },
      { label: "Próxima parcela", value: cartaDados.proxima_parcela_data ? fmtDateBr(String(cartaDados.proxima_parcela_data)) : "—" },
      { label: "Taxa de transferência", value: fmtMoney(num(cartaDados.taxa_transferencia)) },
    );
  } else if (isFin) {
    detalhesLinhas.push(
      { label: "Valor do bem", value: fmtMoney(num(p.valor_credito)) },
      { label: "Entrada", value: fmtMoney(num(p.entrada)) },
      { label: "Prazo (meses)", value: String(num(p.prazo) ?? "—") },
      { label: "Parcela estimada", value: fmtMoney(num(p.valor_parcela)) },
    );
    const fin = comparativoRaw?.financiamento as Record<string, unknown> | undefined;
    if (fin) {
      detalhesLinhas.push(
        { label: "Total pago", value: fmtMoney(num(fin.valorTotalPago ?? fin.custoFinal)) },
        { label: "Juros estimados", value: fmtMoney(num(fin.jurosTotais)) },
      );
    }
  } else {
    const res = (comparativoRaw ?? dadosSim.resultado ?? {}) as Record<string, unknown>;
    detalhesLinhas.push(
      { label: "Valor do crédito", value: fmtMoney(num(p.valor_credito)) },
      { label: "Prazo (meses)", value: String(num(p.prazo) ?? "—") },
      { label: "Parcela inicial estimada", value: fmtMoney(num(p.valor_parcela) ?? num(res.parcelaEstimada) ?? num(res.primeiraParcela)) },
      { label: "Saldo devedor estimado", value: fmtMoney(num(res.saldoDevedorEstimado) ?? num(res.valorTotalEstimado)) },
      { label: "Total pago em 1 ano (est.)", value: fmtMoney((num(res.parcelaEstimada) ?? num(res.primeiraParcela) ?? 0) * 12) },
      { label: "Lance próprio", value: fmtMoney(num(p.entrada) ?? num(res.entrada)) },
      { label: "Lance embutido", value: fmtMoney(num(res.lanceEmbutido)) },
      { label: "Lance total", value: fmtMoney(num(res.lanceTotal)) },
      {
        label: "Parcela pós-contemplação (avanc.)",
        value: fmtMoney(num(res.parcelaPosContemplacao)),
      },
      {
        label: "Custo adm. efetivo mensal",
        value: res.custoAdmEfetivoMensalPercentual != null
          ? `${Number(res.custoAdmEfetivoMensalPercentual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}% a.m.`
          : "—",
      },
      {
        label: "Custo adm. efetivo anual",
        value: res.custoAdmEfetivoAnualPercentual != null
          ? `${Number(res.custoAdmEfetivoAnualPercentual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}% a.a.`
          : "—",
      },
      { label: "Taxa administrativa (%)", value: String(num(p.taxa_administrativa) ?? "—") },
      { label: "Fundo de reserva (%)", value: String(num(p.fundo_reserva) ?? "—") },
      { label: "Seguro prestamista (%)", value: String(num(p.seguro_prestamista) ?? "—") },
    );
  }

  let comparativo: PropostaPdfData["comparativo"] = null;
  if (comparativoRaw?.consorcio && comparativoRaw?.financiamento) {
    const c = comparativoRaw.consorcio as Record<string, unknown>;
    const f = comparativoRaw.financiamento as Record<string, unknown>;
    comparativo = {
      consorcioParcela: num(c.parcelaEstimada) ?? 0,
      consorcioTotal: num(c.valorTotalEstimado) ?? 0,
      financiamentoParcela: num(f.parcelaEstimada) ?? 0,
      financiamentoTotal: num(f.custoFinal ?? f.valorTotalPago) ?? 0,
      diferencaTotal: num(comparativoRaw.diferencaCustoTotal) ?? 0,
      diferencaParcela: num(comparativoRaw.diferencaParcela) ?? 0,
    };
  }

  let marcosProjecao: MarcoProjecaoPdf[] = [];
  const resumoStored = p.resumo_projecao as MarcoProjecaoPdf[] | null;
  if (resumoStored?.length) {
    marcosProjecao = resumoStored;
  } else if (!isFin && num(p.valor_credito) && num(p.prazo)) {
    const entradaCons: EntradaConsorcio = {
      valorCredito: num(p.valor_credito)!,
      prazoMeses: num(p.prazo)!,
      taxaAdministrativaPercentual: num(p.taxa_administrativa) ?? 20,
      fundoReservaPercentual: num(p.fundo_reserva) ?? 2,
      seguroPrestamistaPercentual: num(p.seguro_prestamista) ?? 0,
      reajusteAnualCredito: num(p.reajuste_credito_anual) ?? 8,
      correcaoAnualParcela: num(p.correcao_parcela_anual) ?? 8,
    };
    marcosProjecao = buildMarcosFromConsorcio(entradaCons, num(p.prazo)!);
  }

  const consultorNome = overrides?.consultor_nome ?? (p.consultor_nome as string) ?? null;
  const consultorTel = overrides?.consultor_telefone ?? (p.consultor_telefone as string) ?? null;
  const consultorEmail = overrides?.consultor_email ?? (p.consultor_email as string) ?? null;
  const usarConsultor = !!(consultorNome && (consultorTel || consultorEmail));

  const propostasFull: PropostasConfig = {
    ...DEFAULT_PROPOSTAS,
    ...propostasCfg,
    blocos: { ...DEFAULT_PROPOSTAS.blocos, ...(propostasCfg as PropostasConfig).blocos },
    linhasGrupo: { ...DEFAULT_PROPOSTAS.linhasGrupo, ...(propostasCfg as PropostasConfig).linhasGrupo },
  };
  const observacaoConsultor =
    (overrides?.observacao ?? (p.observacoes as string) ?? "").trim() || null;

  const validadePadrao = propostasCfg.validadePadraoDias ?? 7;
  let validadeTexto = resolveValidadeTexto(p, validadePadrao);
  if (overrides?.validade_data) validadeTexto = fmtDateBr(overrides.validade_data);

  const valorTotal =
    num((comparativoRaw?.consorcio as Record<string, unknown>)?.saldoDevedorEstimado) ??
    num((comparativoRaw?.consorcio as Record<string, unknown>)?.valorTotalEstimado) ??
    comparativo?.consorcioTotal ??
    null;

  return {
    propostaId,
    dataEmissao: fmtDateBr(String(p.created_at ?? new Date().toISOString())),
    validadeTexto,
    cliente: {
      nome: String(p.nome_cliente ?? "Cliente"),
      whatsapp: (p.whatsapp_cliente as string) ?? null,
      email: (p.email_cliente as string) ?? null,
      cidade: (p.cidade_cliente as string) ?? null,
    },
    tipoProposta: tipo || "Consórcio",
    tipoBem: (p.tipo_bem as string) ?? null,
    parceiroNome: overrides?.parceiro_nome ?? (p.parceiro_nome as string) ?? null,
    consultor: {
      nome: consultorNome,
      telefone: consultorTel,
      email: consultorEmail,
      usarConsultor,
    },
    contatoGauchinho: {
      nomeEmpresa: site.nomeEmpresa || "Gauchinho Escritório de Soluções Financeiras",
      whatsapp: contato.whatsappPrincipal || null,
      email: contato.email || null,
      site: site.siteUrl || null,
      endereco: contato.endereco || null,
    },
    resumo: {
      valorCredito: num(p.valor_credito),
      prazo: num(p.prazo),
      parcela: num(p.valor_parcela),
      entrada: num(p.entrada),
      lanceEmbutido: gruposTotais?.lanceTotal ?? null,
      valorTotal,
      creditoLiquido: gruposTotais?.creditoLiquido ?? null,
    },
    detalhesLinhas,
    gruposCotas,
    gruposTotais,
    comparativo,
    marcosProjecao,
    mostrarProjecao: !isFin && !isCarta && marcosProjecao.length > 0,
    capaEstilo: propostasFull.capaEstilo === "campanha" ? "campanha" : "padrao",
    observacaoConsultor,
    segmentos,
    consolidado,
    blocos: propostasFull.blocos,
    linhasGrupo: propostasFull.linhasGrupo,
    visualizacao: overrides?.visualizacao === "resumida" ? "resumida" : "completa",
  };
}
