import {
  calcularParcelaConsorcio,
  type EntradaConsorcio,
  type ResultadoConsorcio,
} from "./consorcio";
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
