import {
  simularFinanciamento,
  type EntradaFinanciamento,
  type ResultadoFinanciamento,
} from "@/lib/simulador/financiamento";

export type { EntradaFinanciamento, ResultadoFinanciamento };

export function calcularFinanciamentoCalculadora(
  input: EntradaFinanciamento,
): ResultadoFinanciamento {
  return simularFinanciamento({
    valorBem: Math.max(0, input.valorBem),
    entrada: Math.max(0, input.entrada),
    taxaMensalPercentual: Math.max(0, input.taxaMensalPercentual),
    prazoMeses: Math.max(1, Math.floor(input.prazoMeses)),
  });
}
