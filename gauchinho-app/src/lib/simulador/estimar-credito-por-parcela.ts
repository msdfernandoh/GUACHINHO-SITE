import { calcularParcelaConsorcio } from "@/lib/simulador/consorcio";

export type EstimarCreditoPorParcelaInput = {
  parcelaDesejada: number;
  prazoMeses: number;
  percentualParcelaReduzida: number;
  taxaAdministrativaPercentual: number;
  fundoReservaPercentual: number;
  seguroPrestamistaPercentual?: number;
};

export type EstimarCreditoPorParcelaResult = {
  creditoContratadoEstimado: number;
  parcelaReduzida: number;
  parcelaIntegral: number;
  saldoDevedorEstimado: number;
};

function parcelaReduzidaParaCredito(
  credito: number,
  input: EstimarCreditoPorParcelaInput,
): number {
  const r = calcularParcelaConsorcio({
    valorCredito: credito,
    prazoMeses: input.prazoMeses,
    taxaAdministrativaPercentual: input.taxaAdministrativaPercentual,
    fundoReservaPercentual: input.fundoReservaPercentual,
    seguroPrestamistaPercentual: input.seguroPrestamistaPercentual ?? 0,
    percentualParcelaInicial: input.percentualParcelaReduzida,
  });
  return r.parcelaEstimada;
}

function resultadoParaCredito(
  credito: number,
  input: EstimarCreditoPorParcelaInput,
): EstimarCreditoPorParcelaResult {
  const r = calcularParcelaConsorcio({
    valorCredito: credito,
    prazoMeses: input.prazoMeses,
    taxaAdministrativaPercentual: input.taxaAdministrativaPercentual,
    fundoReservaPercentual: input.fundoReservaPercentual,
    seguroPrestamistaPercentual: input.seguroPrestamistaPercentual ?? 0,
    percentualParcelaInicial: input.percentualParcelaReduzida,
  });
  return {
    creditoContratadoEstimado: Math.round(credito * 100) / 100,
    parcelaReduzida: Math.round(r.parcelaEstimada * 100) / 100,
    parcelaIntegral: Math.round(r.parcelaIntegral * 100) / 100,
    saldoDevedorEstimado: Math.round(r.saldoDevedorEstimado * 100) / 100,
  };
}

/** Busca binária: crédito cujo parcela reduzida se aproxima da parcela desejada. */
export function estimarCreditoConsorcioPorParcela(
  input: EstimarCreditoPorParcelaInput,
): EstimarCreditoPorParcelaResult | null {
  const alvo = Math.max(0, input.parcelaDesejada);
  const prazo = Math.max(1, Math.floor(input.prazoMeses));
  if (alvo <= 0 || prazo <= 0) return null;

  const base: EstimarCreditoPorParcelaInput = { ...input, prazoMeses: prazo };

  let lo = 1_000;
  let hi = 50_000_000;
  while (parcelaReduzidaParaCredito(hi, base) < alvo && hi < 200_000_000) {
    hi *= 2;
  }
  if (parcelaReduzidaParaCredito(lo, base) > alvo) {
    return resultadoParaCredito(lo, base);
  }

  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    const p = parcelaReduzidaParaCredito(mid, base);
    if (p > alvo) hi = mid;
    else lo = mid;
  }

  return resultadoParaCredito((lo + hi) / 2, base);
}

export function projetarCreditoReajustado(
  creditoContratado: number,
  reajusteAnualPercentual: number,
  prazoMeses: number,
): number {
  const anos = Math.max(0, prazoMeses) / 12;
  const fator = Math.pow(1 + reajusteAnualPercentual / 100, anos);
  return Math.round(creditoContratado * fator * 100) / 100;
}
