import {
  calcularLancePropriaCartaSemBolso,
  calcularParcelaConsorcio,
  type EntradaConsorcio,
  type ResultadoConsorcio,
} from "./consorcio";
import type { SimuladorTipoBemConfig } from "@/lib/config/defaults";
import { opcoesParcelaAtivas } from "@/lib/config/simulador-parcela-opcoes";
import {
  simularFinanciamento,
  type EntradaFinanciamento,
  type ResultadoFinanciamento,
} from "./financiamento";

export type EntradaComparativoFinanciamento = {
  modo: "consorcio" | "financiamento";
  valorCreditoConsorcio: number;
  prazoConsorcioMeses: number;
  valorBemFinanciamento: number;
  entradaFinanciamento: number;
  prazoFinanciamentoMeses: number;
  taxaMensalPercentual: number;
};

/** Financiamento de referência alinhado ao crédito e prazo do consórcio (sem entrada no modo consórcio). */
export function montarEntradaFinanciamentoComparativo(
  p: EntradaComparativoFinanciamento,
): EntradaFinanciamento {
  if (p.modo === "consorcio") {
    return {
      valorBem: p.valorCreditoConsorcio,
      entrada: 0,
      taxaMensalPercentual: p.taxaMensalPercentual,
      prazoMeses: p.prazoConsorcioMeses,
    };
  }
  return {
    valorBem: p.valorBemFinanciamento,
    entrada: p.entradaFinanciamento,
    taxaMensalPercentual: p.taxaMensalPercentual,
    prazoMeses: p.prazoFinanciamentoMeses,
  };
}

export type ComparativoConsorcioFinanciamento = {
  consorcio: ResultadoConsorcio;
  financiamento: ResultadoFinanciamento;
  diferencaCustoTotal: number;
  diferencaParcela: number;
};

export function compararConsorcioFinanciamento(
  consorcio: EntradaConsorcio,
  financiamento: EntradaFinanciamento,
): ComparativoConsorcioFinanciamento {
  const resConsorcio = calcularParcelaConsorcio(consorcio);
  const resFin = simularFinanciamento(financiamento);

  return {
    consorcio: resConsorcio,
    financiamento: resFin,
    diferencaCustoTotal: resFin.custoFinal - resConsorcio.valorTotalEstimado,
    diferencaParcela: resFin.parcelaEstimada - resConsorcio.parcelaEstimada,
  };
}

export type DetalheAlternativaConsorcio = {
  valorCredito: number;
  prazoMeses: number;
  parcelaCheia: number;
  parcelaReduzida: number;
  labelParcelaReduzida: string;
  saldoDevedorEstimado: number;
  lancePropriaCarta: number;
  creditoLiquidoEstimado: number;
};

/** Alternativa de consórcio para quem simula financiamento (mesmo crédito e prazo). */
export function detalharAlternativaConsorcio(
  entrada: EntradaConsorcio,
  bemCfg: SimuladorTipoBemConfig,
): DetalheAlternativaConsorcio {
  const integral = calcularParcelaConsorcio({
    ...entrada,
    percentualParcelaInicial: 100,
  });
  const opcoes = opcoesParcelaAtivas(bemCfg);
  const opcaoReduzida =
    opcoes.find((o) => o.percentual < 100) ?? opcoes[opcoes.length - 1];
  const pctRed = opcaoReduzida?.percentual ?? 60;
  const reduzida = calcularParcelaConsorcio({
    ...entrada,
    percentualParcelaInicial: pctRed,
  });
  const lance = calcularLancePropriaCartaSemBolso(integral.saldoDevedorEstimado);
  return {
    valorCredito: entrada.valorCredito,
    prazoMeses: entrada.prazoMeses,
    parcelaCheia: integral.parcelaEstimada,
    parcelaReduzida: reduzida.parcelaEstimada,
    labelParcelaReduzida: opcaoReduzida?.nome ?? `${pctRed}% da parcela integral`,
    saldoDevedorEstimado: integral.saldoDevedorEstimado,
    lancePropriaCarta: lance,
    creditoLiquidoEstimado: Math.max(0, entrada.valorCredito - lance),
  };
}
