import type { GrupoConsorcio, GrupoModalidadeLance } from "@/lib/types";
import { calcularPrazoGrupoFromRow, calcularCicloGrupoDatas } from "@/lib/grupos/prazos";
import { listarModalidadesLanceAtivas } from "@/lib/grupos/simulacao-linha";
import { normalizarPercentualGrupo } from "@/lib/grupos/percentual";
import { fatorSeguroGrupo } from "@/lib/grupos/seguro";
import { calcularCustoDiluido, fmtPercent } from "./custo-plano";
import { fmtMoney, fmtDateBr } from "./format";
import type {
  GrupoPdfBlock,
  ModalidadeLancePdf,
  PropostaConsolidadoPdf,
  SegmentoPdf,
  SegmentoTipo,
} from "./types";

/** Linha crua de `simulacoes_grupos_itens` (colunas usadas pela proposta). */
export type ItemGrupoRow = {
  grupo_id: string | null;
  codigo_grupo: string | null;
  modalidade: string | null;
  valor_credito: number | null;
  quantidade_cotas: number | null;
  saldo_devedor: number | null;
  primeira_parcela: number | null;
  lance_embutido: number | null;
  recurso_proprio: number | null;
  lance_total: number | null;
  parcela_pos_contemplacao: number | null;
  credito_liquido: number | null;
  parcelas_realizadas: number | null;
  prazo_restante: number | null;
  modalidade_lance_id: string | null;
  dados_linha: Record<string, unknown> | null;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function segmentoDe(modalidade: string | null | undefined): SegmentoTipo {
  const m = (modalidade ?? "").trim().toLocaleLowerCase("pt-BR");
  if (m.includes("imóv") || m.includes("imov")) return "imovel";
  if (
    m.includes("auto") ||
    m.includes("veíc") ||
    m.includes("veic") ||
    m.includes("moto") ||
    m.includes("caminh") ||
    m.includes("máquin") ||
    m.includes("maquin")
  ) {
    return "veiculo";
  }
  return "outro";
}

const SEG_LABEL: Record<SegmentoTipo, string> = {
  imovel: "Imóvel",
  veiculo: "Veículo",
  outro: "Outros bens",
};

function reajusteLabel(g: GrupoConsorcio | undefined): string {
  if (!g) return "anual";
  if (g.tipo_reajuste_anual === "FIXO" && g.reajuste_anual_percentual) {
    return `pré-fixado ${g.reajuste_anual_percentual.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% a.a.`;
  }
  if (g.tipo_reajuste_anual === "VARIAVEL" && g.reajuste_anual_indice) {
    return `${g.reajuste_anual_indice} · anual`;
  }
  const legado = num((g as Record<string, unknown>).reajuste_credito_anual);
  return legado > 0 ? `${legado.toLocaleString("pt-BR")}% a.a.` : "anual";
}

function seguroLabel(g: GrupoConsorcio | undefined): string {
  if (!g) return "—";
  const fator = fatorSeguroGrupo(g.seguro_percentual);
  if (fator <= 0) return "não incide";
  return `${(fator * 100).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}% / mês`;
}

function inicioGrupo(g: GrupoConsorcio | undefined): string {
  if (!g) return "—";
  if (g.data_primeira_assembleia) return fmtDateBr(String(g.data_primeira_assembleia));
  const estimada = calcularCicloGrupoDatas(g).dataPrimeiraAssembleia;
  return estimada ? fmtDateBr(estimada) : "—";
}

function parcelaTipoLabel(dados: Record<string, unknown> | null): string {
  const config = (dados?.config ?? {}) as Record<string, unknown>;
  const tipo = String(config.modalidadeParcela ?? "integral");
  if (tipo === "reduzida") {
    const pct = normalizarPercentualGrupo(Number(config.percentualParcelaReduzida)) || 50;
    return `parcela reduzida ${pct}%`;
  }
  if (tipo === "personalizada") {
    const pct = Number(config.percentualParcelaPersonalizada);
    return pct > 0 ? `parcela personalizada ${pct}%` : "parcela personalizada";
  }
  return "parcela integral";
}

function montarModalidades(
  grupo: GrupoConsorcio | undefined,
  mods: GrupoModalidadeLance[],
  saldoDevedor: number,
  credito: number,
  escolhidaId: string | null,
  escolhidaNome: string | null,
): ModalidadeLancePdf[] {
  if (!grupo) return [];
  const ativas = listarModalidadesLanceAtivas(grupo, mods);
  return ativas.map((m) => {
    const base = m.base_referencia === "CREDITO" ? credito : saldoDevedor;
    const pctEmb = normalizarPercentualGrupo(m.percentual_lance_embutido);
    const pctRec = normalizarPercentualGrupo(m.percentual_recurso_proprio_minimo);
    const escolhida =
      (escolhidaId != null && m.id === escolhidaId) ||
      (escolhidaNome != null && m.nome === escolhidaNome);
    return {
      nome: m.nome,
      embutidoLabel: pctEmb > 0 ? `${pctEmb}%` : "livre",
      recProprioLabel: pctRec > 0 ? `mín. ${pctRec}%` : "livre",
      baseLabel: m.base_referencia === "CREDITO" ? "Crédito" : "Saldo devedor",
      lanceTotalLabel:
        pctEmb > 0 ? fmtMoney(Math.round((base * pctEmb) / 100)) : "variável",
      escolhida,
    };
  });
}

function evolucaoDe(
  dados: Record<string, unknown> | null,
  segmento: SegmentoTipo,
): GrupoPdfBlock["evolucao"] {
  const r = (dados?.resultado ?? {}) as Record<string, unknown>;
  const saldoPosLance = num(r.saldoPosLance);
  const parcelaPos = num(r.parcelaPosContemplacao);
  const prazoPos = num(r.prazoRestanteAposContemplacao || r.parcelasRestantesPosContemplacao);
  const out: GrupoPdfBlock["evolucao"] = [];
  if (saldoPosLance > 0) {
    out.push({ periodo: "Contemplação", linhas: [`Saldo após lance ${fmtMoney(saldoPosLance)}`] });
  }
  if (parcelaPos > 0) {
    out.push({
      periodo: "Mês seguinte",
      linhas: [`Parcela ≈ ${fmtMoney(parcelaPos)}`],
    });
  }
  if (prazoPos > 0) {
    out.push({
      periodo: "Quitação",
      linhas: [`≈ ${Math.round(prazoPos)} meses após contemplar`],
    });
  }
  if (segmento === "imovel") {
    out.push({ periodo: "Crédito", linhas: ["Reajustado a cada 12 meses"] });
  }
  return out;
}

export function construirSegmentos(
  itens: ItemGrupoRow[],
  gruposById: Map<string, GrupoConsorcio>,
  modsByGrupo: Map<string, GrupoModalidadeLance[]>,
): { segmentos: SegmentoPdf[]; consolidado: PropostaConsolidadoPdf } {
  const blocos: GrupoPdfBlock[] = itens.map((it) => {
    const grupo = it.grupo_id ? gruposById.get(it.grupo_id) : undefined;
    const mods = it.grupo_id ? modsByGrupo.get(it.grupo_id) ?? [] : [];
    const dados = it.dados_linha;
    const segmento = segmentoDe(it.modalidade ?? grupo?.modalidade);
    const prazo = grupo
      ? calcularPrazoGrupoFromRow(grupo)
      : { prazoTotal: 0, parcelasRealizadasAtuais: num(it.parcelas_realizadas), prazoRestanteAtual: num(it.prazo_restante) };
    const taxaAdm = normalizarPercentualGrupo(grupo?.taxa_administrativa_percentual);
    const fundo = normalizarPercentualGrupo(grupo?.fundo_reserva_percentual);
    const custo = calcularCustoDiluido(taxaAdm, fundo, prazo.prazoTotal || null);
    const credito = num(it.valor_credito) * Math.max(1, num(it.quantidade_cotas) || 1);
    const saldoDevedor = num(it.saldo_devedor);
    const escolhidaId = it.modalidade_lance_id;
    const modLanceSnap = (dados?.modalidade_lance ?? null) as { id?: string; nome?: string } | null;
    const escolhidaNome = modLanceSnap?.nome ?? null;

    return {
      segmento,
      codigoGrupo: String(it.codigo_grupo ?? grupo?.codigo_grupo ?? "—"),
      cotaLabel: fmtMoney(num(it.valor_credito)),
      quantidadeCotas: Math.max(1, num(it.quantidade_cotas) || 1),
      administradora: grupo?.administradora ?? "Racon",
      inicioGrupo: inicioGrupo(grupo),
      prazoTotal: prazo.prazoTotal || null,
      prazoRestante: prazo.prazoRestanteAtual || num(it.prazo_restante) || null,
      assembleiasDecorridas: prazo.parcelasRealizadasAtuais || num(it.parcelas_realizadas) || null,
      taxaAdmPercentual: taxaAdm || null,
      fundoReservaPercentual: fundo || null,
      seguroLabel: seguroLabel(grupo),
      reajusteLabel: reajusteLabel(grupo),
      contemplacaoLabel: "Sorteio e lance",
      custoBasePercentual: custo.basePercentual,
      custoMesLabel: fmtPercent(custo.percentualMes),
      custoAnoLabel: fmtPercent(custo.percentualAno),
      credito,
      saldoDevedor,
      primeiraParcela: num(it.primeira_parcela),
      parcelaTipoLabel: parcelaTipoLabel(dados),
      lanceEmbutido: num(it.lance_embutido),
      recursoProprio: num(it.recurso_proprio),
      lanceTotal: num(it.lance_total),
      creditoLiquido: num(it.credito_liquido),
      parcelaPosContemplacao: num(it.parcela_pos_contemplacao),
      modalidadeEscolhidaNome: escolhidaNome,
      modalidades: montarModalidades(grupo, mods, saldoDevedor, credito, escolhidaId, escolhidaNome),
      evolucao: evolucaoDe(dados, segmento),
    } satisfies GrupoPdfBlock;
  });

  const ordem: SegmentoTipo[] = ["imovel", "veiculo", "outro"];
  const segmentos: SegmentoPdf[] = ordem
    .map((tipo) => {
      const grupos = blocos.filter((b) => b.segmento === tipo);
      if (grupos.length === 0) return null;
      const totais = grupos.reduce(
        (acc, g) => ({
          credito: acc.credito + g.credito,
          primeiraParcela: acc.primeiraParcela + g.primeiraParcela,
          lanceEmbutido: acc.lanceEmbutido + g.lanceEmbutido,
          recursoProprio: acc.recursoProprio + g.recursoProprio,
          lanceTotal: acc.lanceTotal + g.lanceTotal,
          creditoLiquido: acc.creditoLiquido + g.creditoLiquido,
          parcelaPosContemplacao: acc.parcelaPosContemplacao + g.parcelaPosContemplacao,
        }),
        {
          credito: 0,
          primeiraParcela: 0,
          lanceEmbutido: 0,
          recursoProprio: 0,
          lanceTotal: 0,
          creditoLiquido: 0,
          parcelaPosContemplacao: 0,
        },
      );
      return { tipo, label: SEG_LABEL[tipo], grupos, totais } satisfies SegmentoPdf;
    })
    .filter((s): s is SegmentoPdf => s !== null);

  const todos = segmentos.flatMap((s) => s.grupos);
  const consolidado: PropostaConsolidadoPdf = {
    totalGrupos: todos.length,
    totalCotas: todos.reduce((a, g) => a + g.quantidadeCotas, 0),
    credito: todos.reduce((a, g) => a + g.credito, 0),
    primeiraParcela: todos.reduce((a, g) => a + g.primeiraParcela, 0),
    lanceEmbutido: todos.reduce((a, g) => a + g.lanceEmbutido, 0),
    recursoProprio: todos.reduce((a, g) => a + g.recursoProprio, 0),
    lanceTotal: todos.reduce((a, g) => a + g.lanceTotal, 0),
    creditoLiquido: todos.reduce((a, g) => a + g.creditoLiquido, 0),
    parcelaPosContemplacaoMedia: todos.length
      ? todos.reduce((a, g) => a + g.parcelaPosContemplacao, 0) / todos.length
      : 0,
  };

  return { segmentos, consolidado };
}
