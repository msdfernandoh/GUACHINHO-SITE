/**
 * Cálculos de consórcio — única fonte (UI consome apenas estes exports).
 */

export type EntradaConsorcio = {
  valorCredito: number;
  prazoMeses: number;
  taxaAdministrativaPercentual: number;
  fundoReservaPercentual: number;
  seguroPrestamistaPercentual: number;
  entrada?: number;
  lanceEmbutido?: number;
  reajusteAnualCredito?: number;
  correcaoAnualParcela?: number;
};

export type ResultadoConsorcio = {
  valorCredito: number;
  prazoMeses: number;
  parcelaEstimada: number;
  taxaAdministrativaTotal: number;
  fundoReservaTotal: number;
  seguroMensal: number;
  seguroTotalEstimado: number;
  valorTotalEstimado: number;
  entrada: number;
  lanceEmbutido: number;
};

export function calcularTaxaAdministrativaTotal(
  credito: number,
  taxaPercentual: number,
): number {
  return credito * (taxaPercentual / 100);
}

export function calcularFundoReservaTotal(
  credito: number,
  fundoPercentual: number,
): number {
  return credito * (fundoPercentual / 100);
}

/** Seguro prestamista: percentual anual sobre o crédito, cobrado mensalmente. */
export function calcularSeguroPrestamistaMensal(
  credito: number,
  seguroAnualPercentual: number,
): number {
  if (!seguroAnualPercentual) return 0;
  return (credito * (seguroAnualPercentual / 100)) / 12;
}

export function calcularSeguroPrestamistaTotal(
  credito: number,
  seguroAnualPercentual: number,
  prazoMeses: number,
): number {
  return calcularSeguroPrestamistaMensal(credito, seguroAnualPercentual) * prazoMeses;
}

export function calcularValorTotalConsorcio(
  credito: number,
  taxaAdmTotal: number,
  fundoTotal: number,
  seguroTotal: number,
  entrada = 0,
  lanceEmbutido = 0,
): number {
  return credito + taxaAdmTotal + fundoTotal + seguroTotal - entrada - lanceEmbutido;
}

export function calcularParcelaConsorcio(entrada: EntradaConsorcio): ResultadoConsorcio {
  const credito = entrada.valorCredito;
  const prazo = Math.max(entrada.prazoMeses, 1);
  const taxaAdministrativaTotal = calcularTaxaAdministrativaTotal(
    credito,
    entrada.taxaAdministrativaPercentual,
  );
  const fundoReservaTotal = calcularFundoReservaTotal(
    credito,
    entrada.fundoReservaPercentual,
  );
  const seguroMensal = calcularSeguroPrestamistaMensal(
    credito,
    entrada.seguroPrestamistaPercentual,
  );
  const seguroTotalEstimado = seguroMensal * prazo;
  const entradaValor = entrada.entrada ?? 0;
  const lanceEmbutido = entrada.lanceEmbutido ?? 0;
  const baseAmortizavel =
    credito + taxaAdministrativaTotal + fundoReservaTotal - entradaValor - lanceEmbutido;
  const parcelaBase = baseAmortizavel / prazo;
  const parcelaEstimada = parcelaBase + seguroMensal;
  const valorTotalEstimado =
    parcelaEstimada * prazo + entradaValor + lanceEmbutido;

  return {
    valorCredito: credito,
    prazoMeses: prazo,
    parcelaEstimada,
    taxaAdministrativaTotal,
    fundoReservaTotal,
    seguroMensal,
    seguroTotalEstimado,
    valorTotalEstimado,
    entrada: entradaValor,
    lanceEmbutido,
  };
}
