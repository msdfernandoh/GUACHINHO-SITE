/**
 * Financiamento — prestação fixa (Tabela Price).
 */

export type EntradaFinanciamento = {
  valorBem: number;
  entrada: number;
  taxaMensalPercentual: number;
  prazoMeses: number;
};

export type ResultadoFinanciamento = {
  valorBem: number;
  entrada: number;
  valorFinanciado: number;
  prazoMeses: number;
  parcelaEstimada: number;
  valorTotalPago: number;
  jurosTotais: number;
  custoFinal: number;
};

export function calcularValorFinanciado(valorBem: number, entrada: number): number {
  return Math.max(valorBem - entrada, 0);
}

export function calcularParcelaFinanciamento(entrada: EntradaFinanciamento): number {
  const pv = calcularValorFinanciado(entrada.valorBem, entrada.entrada);
  const n = Math.max(entrada.prazoMeses, 1);
  const i = entrada.taxaMensalPercentual / 100;
  if (i === 0) return pv / n;
  const fator = (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
  return pv * fator;
}

export function calcularTotalPagoFinanciamento(
  parcela: number,
  prazoMeses: number,
  entrada: number,
): number {
  return parcela * prazoMeses + entrada;
}

export function calcularJurosTotaisFinanciamento(
  totalPago: number,
  valorBem: number,
): number {
  return Math.max(totalPago - valorBem, 0);
}

export function simularFinanciamento(entrada: EntradaFinanciamento): ResultadoFinanciamento {
  const valorFinanciado = calcularValorFinanciado(entrada.valorBem, entrada.entrada);
  const parcelaEstimada = calcularParcelaFinanciamento(entrada);
  const valorTotalPago = calcularTotalPagoFinanciamento(
    parcelaEstimada,
    entrada.prazoMeses,
    entrada.entrada,
  );
  const jurosTotais = calcularJurosTotaisFinanciamento(valorTotalPago, entrada.valorBem);

  return {
    valorBem: entrada.valorBem,
    entrada: entrada.entrada,
    valorFinanciado,
    prazoMeses: entrada.prazoMeses,
    parcelaEstimada,
    valorTotalPago,
    jurosTotais,
    custoFinal: valorTotalPago,
  };
}
