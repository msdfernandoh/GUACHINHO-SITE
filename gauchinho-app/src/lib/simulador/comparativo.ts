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
