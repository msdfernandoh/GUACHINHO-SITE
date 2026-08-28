import type { ContratacaoOrigem } from "./types";
import { calcularPrazoGrupoFromRow } from "@/lib/grupos/prazos";
import type { GrupoConsorcio } from "@/lib/types";
import {
  calcularCustoEfetivoAnual,
  calcularCustoEfetivoMensal,
} from "@/lib/simulador/consorcio";

type FlatFields = {
  tipo_bem: string | null;
  credito_selecionado: number | null;
  parcela_estimada: number | null;
  prazo: number | null;
  grupo_id: string | null;
  grupo_nome: string | null;
  administradora: string | null;
  cota_id: string | null;
};

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function somarResultados(
  selecoes: unknown[],
  campo: string,
): number | null {
  let encontrou = false;
  const total = selecoes.reduce<number>((acc, raw) => {
    const selecao = (raw ?? {}) as Record<string, unknown>;
    const resultado = (selecao.resultado ?? {}) as Record<string, unknown>;
    const valor = num(resultado[campo]);
    if (valor == null) return acc;
    encontrou = true;
    return acc + valor;
  }, 0);
  return encontrou ? total : null;
}

function somarParcelasReduzidas(selecoes: unknown[]): number | null {
  let encontrou = false;
  const total = selecoes.reduce<number>((acc, raw) => {
    const selecao = (raw ?? {}) as Record<string, unknown>;
    const config = (selecao.config ?? {}) as Record<string, unknown>;
    const resultado = (selecao.resultado ?? {}) as Record<string, unknown>;
    const modalidade = str(config.modalidadeParcela);
    const primeiraParcela = num(resultado.primeiraParcela);
    if (
      (modalidade === "reduzida" || modalidade === "personalizada") &&
      primeiraParcela != null
    ) {
      encontrou = true;
      return acc + primeiraParcela;
    }
    const valor =
      modalidade === "personalizada"
        ? num(resultado.parcelaPersonalizada) ??
          num(resultado.parcelaBase) ??
          num(resultado.parcelaReduzida)
        : num(resultado.parcelaReduzida);
    if (valor == null) return acc;
    encontrou = true;
    const quantidade = Math.max(1, Math.floor(num(config.quantidadeCotas) ?? num(resultado.quantidadeCotas) ?? 1));
    return acc + valor * quantidade;
  }, 0);
  return encontrou ? total : null;
}

function somarParcelasIntegrais(selecoes: unknown[]): number | null {
  let encontrou = false;
  const total = selecoes.reduce<number>((acc, raw) => {
    const selecao = (raw ?? {}) as Record<string, unknown>;
    const config = (selecao.config ?? {}) as Record<string, unknown>;
    const resultado = (selecao.resultado ?? {}) as Record<string, unknown>;
    const valor = num(resultado.parcelaIntegral) ?? num(resultado.parcelaBase);
    if (valor == null) return acc;
    encontrou = true;
    const quantidade = Math.max(1, Math.floor(num(config.quantidadeCotas) ?? num(resultado.quantidadeCotas) ?? 1));
    return acc + valor * quantidade;
  }, 0);
  return encontrou ? total : null;
}

function percentualParcelaReduzida(selecoes: unknown[]): number | null {
  const percentuais = selecoes.flatMap((raw) => {
    const selecao = (raw ?? {}) as Record<string, unknown>;
    const config = (selecao.config ?? {}) as Record<string, unknown>;
    const resultado = (selecao.resultado ?? {}) as Record<string, unknown>;
    const integral = num(resultado.parcelaIntegral);
    const reduzida =
      str(config.modalidadeParcela) === "personalizada"
        ? num(resultado.parcelaPersonalizada) ?? num(resultado.parcelaBase)
        : num(resultado.parcelaReduzida);
    if (integral == null || integral <= 0 || reduzida == null) return [];
    return [Math.round((reduzida / integral) * 10_000) / 100];
  });
  if (percentuais.length === 0) return null;
  const primeiro = percentuais[0]!;
  return percentuais.every((percentual) => Math.abs(percentual - primeiro) < 0.01)
    ? primeiro
    : null;
}

function custoEfetivoFromGrupo(grupo: Record<string, unknown>): {
  mensal: number | null;
  anual: number | null;
} {
  const taxa = num(grupo.taxa_administrativa_percentual);
  const prazo = num(grupo.prazo_total) ?? num(grupo.prazo_meses);
  if (taxa == null || taxa <= 0 || prazo == null || prazo <= 0) {
    return { mensal: null, anual: null };
  }
  const mensal = calcularCustoEfetivoMensal(taxa, prazo);
  return { mensal, anual: calcularCustoEfetivoAnual(mensal) };
}

function parcelasRestantesFromGrupoDados(
  grupo: Record<string, unknown>,
  resultado: Record<string, unknown>,
  totais: Record<string, unknown>,
): number | null {
  const fromGrupo = num(grupo.prazo_restante);
  if (fromGrupo != null && fromGrupo >= 0) return Math.round(fromGrupo);

  const fromResultado = num(resultado.parcelasRestantesPosContemplacao);
  if (fromResultado != null && fromResultado >= 0) return Math.round(fromResultado);

  const fromTotais = num(totais.parcelasRestantesMax);
  if (fromTotais != null && fromTotais >= 0) return Math.round(fromTotais);

  const total = num(grupo.prazo_total) ?? num(grupo.prazo_meses);
  const realizadas = num(grupo.parcelas_realizadas);
  if (total != null && realizadas != null) {
    return Math.max(Math.round(total - realizadas), 0);
  }
  return null;
}

export type LinhaGrupoPropostaResumo = {
  codigoGrupo: string;
  modalidade: string | null;
  quantidadeCotas: number;
  valorCota: number | null;
  parcelasRealizadas: number | null;
};

function parcelasRealizadasGrupoSnap(grupo: Record<string, unknown>): number | null {
  const direct = num(grupo.parcelas_realizadas);
  if (direct != null) return Math.round(direct);
  if (
    grupo.prazo_total != null ||
    grupo.data_base_parcelas != null ||
    grupo.parcelas_realizadas_base != null
  ) {
    try {
      return calcularPrazoGrupoFromRow(grupo as GrupoConsorcio).parcelasRealizadasAtuais;
    } catch {
      return null;
    }
  }
  return null;
}

/** Uma linha por grupo selecionado na simulação /grupos (suporta vários na mesma proposta). */
export function linhasGrupoResumoFromDados(
  origem: ContratacaoOrigem,
  dados: Record<string, unknown>,
): LinhaGrupoPropostaResumo[] {
  if (origem !== "grupos") return [];
  const selecoes = Array.isArray(dados.selecoes) ? dados.selecoes : [];
  return selecoes.map((raw) => {
    const sel = (raw ?? {}) as Record<string, unknown>;
    const grupo = (sel.grupo ?? {}) as Record<string, unknown>;
    const config = (sel.config ?? {}) as Record<string, unknown>;
    const resultado = (sel.resultado ?? {}) as Record<string, unknown>;
    const codigoGrupo =
      str(grupo.codigo_grupo) ?? str(sel.codigoGrupo) ?? str(grupo.codigo) ?? "—";
    const modalidade = str(grupo.modalidade);
    const quantidadeCotas =
      Math.max(
        0,
        Math.floor(
          num(config.quantidadeCotas) ??
            num(resultado.quantidadeCotas) ??
            num(sel.quantidade_cotas) ??
            0,
        ),
      ) || 0;
    const somaCotas = num(resultado.somaCotas);
    const valorCota =
      num(resultado.valorCota) ??
      num(resultado.valorCredito) ??
      (somaCotas != null && quantidadeCotas > 0 ? somaCotas / quantidadeCotas : null);
    return {
      codigoGrupo,
      modalidade,
      quantidadeCotas,
      valorCota,
      parcelasRealizadas: parcelasRealizadasGrupoSnap(grupo),
    };
  });
}

export function extrairCamposFlat(
  origem: ContratacaoOrigem,
  dados: Record<string, unknown>,
): FlatFields {
  if (origem === "simulador") {
    const modo = str(dados.modo);
    const tipoBem = str(dados.tipoBem);
    const entrada = (dados.entrada ?? {}) as Record<string, unknown>;
    const resultado = (dados.resultado ?? {}) as Record<string, unknown>;
    const tipoLabel =
      tipoBem === "imovel" ? "Imóvel" : tipoBem === "automovel" ? "Veículo" : tipoBem;
    const credito =
      num(entrada.valorCredito) ??
      num(entrada.valorBem) ??
      num(resultado.valorCredito);
    const prazo = num(entrada.prazoMeses) ?? num(resultado.prazoMeses);
    const parcela =
      num(resultado.parcelaEstimada) ??
      num((resultado as { consorcio?: { parcelaEstimada?: number } }).consorcio?.parcelaEstimada);
    return {
      tipo_bem: modo === "financiamento" ? `Financiamento — ${tipoLabel ?? "—"}` : tipoLabel,
      credito_selecionado: credito,
      parcela_estimada: parcela,
      prazo: prazo != null ? Math.round(prazo) : null,
      grupo_id: null,
      grupo_nome: null,
      administradora: null,
      cota_id: null,
    };
  }

  const selecoes = Array.isArray(dados.selecoes) ? dados.selecoes : [];
  const linhasGrupo = linhasGrupoResumoFromDados("grupos", dados);
  const first = (selecoes[0] ?? {}) as Record<string, unknown>;
  const grupo = (first.grupo ?? {}) as Record<string, unknown>;
  const resultado = (first.resultado ?? {}) as Record<string, unknown>;
  const totais = (dados.totais ?? {}) as Record<string, unknown>;
  const credito =
    num(totais.somaCotas) ??
    somarResultados(selecoes, "somaCotas") ??
    num(resultado.somaCotas) ??
    num(resultado.creditoLiquido) ??
    num(dados.creditoLiquidoTotal);
  const parcela =
    num(totais.primeiraParcela) ??
    somarResultados(selecoes, "primeiraParcela") ??
    num(resultado.primeiraParcela) ??
    num(dados.primeiraParcelaTotal);
  const prazo = num(grupo.prazo_meses) ?? num(grupo.prazo_total) ?? num(resultado.parcelasRestantesPosContemplacao);
  const grupoNomeResumo =
    linhasGrupo.length > 1
      ? linhasGrupo.map((l) => l.codigoGrupo).join(", ")
      : linhasGrupo[0]?.codigoGrupo ?? str(grupo.codigo_grupo) ?? str(first.grupoId);

  return {
    tipo_bem: str(grupo.modalidade) ?? str(dados.modalidadeResumo),
    credito_selecionado: credito,
    parcela_estimada: parcela,
    prazo: prazo != null ? Math.round(prazo) : null,
    grupo_id: str(grupo.id) ?? str(first.grupoId),
    grupo_nome: grupoNomeResumo,
    administradora: str(grupo.administradora),
    cota_id: str(first.cotaId),
  };
}

export function resumoFinanceiroFromDados(
  origem: ContratacaoOrigem,
  dados: Record<string, unknown>,
): Record<string, number | string | null> {
  if (origem === "simulador") {
    const resultado = (dados.resultado ?? {}) as Record<string, unknown>;
    const entrada = (dados.entrada ?? {}) as Record<string, unknown>;
    const opcao = (resultado.opcaoParcela ?? {}) as Record<string, unknown>;
    const consorcio = (resultado.consorcio ?? resultado) as Record<string, unknown>;
    return {
      parcelaReduzida: num(resultado.parcelaReduzida) ?? num(opcao.parcelaReduzida),
      parcelaIntegral: num(resultado.parcelaAmortizacao) ?? num(resultado.parcelaIntegral),
      lanceEmbutido: num(entrada.lanceEmbutido) ?? num(resultado.lanceEmbutido),
      recursoProprio: num(entrada.entrada) ?? num(resultado.lanceProprio),
      lanceTotal: num(resultado.lanceTotal),
      creditoLiquido: num(resultado.creditoLiquidoPosLance) ?? num(resultado.creditoLiquido),
      saldoPosLance: num(resultado.saldoPosLance) ?? num(resultado.saldoDevedorEstimado),
      seguro: num(resultado.seguroMensal),
      parcelaPosContemplacao: num(resultado.parcelaPosContemplacao),
      custoEfetivoMensal:
        num(consorcio.custoAdmEfetivoMensalPercentual) ??
        num(resultado.custoAdmEfetivoMensalPercentual),
      custoEfetivoAnual:
        num(consorcio.custoAdmEfetivoAnualPercentual) ??
        num(resultado.custoAdmEfetivoAnualPercentual),
      parcelasRestantes: num(consorcio.parcelasRestantes) ?? num(resultado.parcelasRestantes),
    };
  }
  const selecoes = Array.isArray(dados.selecoes) ? dados.selecoes : [];
  const totais = (dados.totais ?? {}) as Record<string, unknown>;
  const first = (selecoes[0] ?? {}) as Record<string, unknown>;
  const config = (first.config ?? {}) as Record<string, unknown>;
  const resultado = (first.resultado ?? {}) as Record<string, unknown>;
  const grupo = (first.grupo ?? {}) as Record<string, unknown>;
  let parcelaReduzida = num(resultado.parcelaReduzida);
  if (str(config.modalidadeParcela) === "personalizada") {
    parcelaReduzida =
      num(resultado.parcelaPersonalizada) ??
      num(resultado.parcelaBase) ??
      parcelaReduzida;
  }
  const parcelaIntegral =
    somarParcelasIntegrais(selecoes) ??
    num(totais.parcelaIntegralTotal) ??
    num(resultado.parcelaIntegral) ??
    num(resultado.parcelaBase) ??
    num(totais.parcelaIntegral);
  const custo = custoEfetivoFromGrupo(grupo);
  return {
    saldoDevedor:
      num(totais.saldoDevedorInicial) ??
      somarResultados(selecoes, "saldoDevedorInicial") ??
      num(resultado.saldoDevedorInicial),
    parcelaReduzida:
      somarParcelasReduzidas(selecoes) ??
      num(totais.parcelaReduzidaTotal) ??
      parcelaReduzida,
    percentualParcelaReduzida: percentualParcelaReduzida(selecoes),
    parcelaIntegral,
    lanceEmbutido:
      num(totais.lanceEmbutido) ??
      somarResultados(selecoes, "lanceEmbutido") ??
      num(resultado.lanceEmbutido),
    recursoProprio:
      num(totais.recursoProprio) ??
      somarResultados(selecoes, "recursoProprio") ??
      num(resultado.recursoProprio),
    lanceTotal:
      num(totais.lanceTotal) ??
      somarResultados(selecoes, "lanceTotal") ??
      num(resultado.lanceTotal),
    creditoLiquido:
      num(totais.creditoLiquido) ??
      somarResultados(selecoes, "creditoLiquido") ??
      num(resultado.creditoLiquido),
    saldoPosLance:
      num(totais.saldoPosLance) ??
      somarResultados(selecoes, "saldoPosLance") ??
      num(resultado.saldoPosLance),
    seguro:
      num(totais.seguroTotal) ??
      somarResultados(selecoes, "seguroMensal") ??
      num(resultado.seguroMensal),
    parcelaPosContemplacao:
      num(totais.parcelaPosContemplacaoTotal) ??
      somarResultados(selecoes, "parcelaPosContemplacao") ??
      num(resultado.parcelaPosContemplacao) ??
      num(totais.parcelaPosContemplacao),
    custoEfetivoMensal: custo.mensal,
    custoEfetivoAnual: custo.anual,
    parcelasRestantes:
      selecoes.length > 1
        ? num(totais.parcelasRestantesMax) ??
          parcelasRestantesFromGrupoDados(grupo, resultado, totais)
        : parcelasRestantesFromGrupoDados(grupo, resultado, totais),
  };
}
