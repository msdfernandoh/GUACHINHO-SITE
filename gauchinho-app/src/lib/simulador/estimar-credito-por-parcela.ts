import {
  calcularParcelaConsorcio,
  calcularParcelaReduzida,
} from "@/lib/simulador/consorcio";

export type EstimarCreditoPorParcelaInput = {
  parcelaDesejada: number;
  prazoMeses: number;
  /** Percentual sobre a parcela integral (ex.: 60 = parcela reduzida). */
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
  percentualParcelaReduzida: number;
};

function resultadoIntegral(credito: number, input: EstimarCreditoPorParcelaInput) {
  return calcularParcelaConsorcio({
    valorCredito: credito,
    prazoMeses: input.prazoMeses,
    taxaAdministrativaPercentual: input.taxaAdministrativaPercentual,
    fundoReservaPercentual: input.fundoReservaPercentual,
    seguroPrestamistaPercentual: input.seguroPrestamistaPercentual ?? 0,
    percentualParcelaInicial: 100,
  });
}

/** Parcela reduzida comercial: percentual sobre a parcela integral (não sobre a amortização isolada). */
export function parcelaReduzidaComparacaoAplicacao(
  credito: number,
  input: EstimarCreditoPorParcelaInput,
): number {
  const pct = Math.min(100, Math.max(1, input.percentualParcelaReduzida));
  const r = resultadoIntegral(credito, input);
  if (pct >= 100) return r.parcelaIntegral;
  return calcularParcelaReduzida(r.parcelaIntegral, pct);
}

function resultadoParaCredito(
  credito: number,
  input: EstimarCreditoPorParcelaInput,
): EstimarCreditoPorParcelaResult {
  const pct = Math.min(100, Math.max(1, input.percentualParcelaReduzida));
  const r = resultadoIntegral(credito, input);
  const reduzida =
    pct >= 100 ? r.parcelaIntegral : calcularParcelaReduzida(r.parcelaIntegral, pct);
  return {
    creditoContratadoEstimado: Math.round(credito * 100) / 100,
    parcelaReduzida: Math.round(reduzida * 100) / 100,
    parcelaIntegral: Math.round(r.parcelaIntegral * 100) / 100,
    saldoDevedorEstimado: Math.round(r.saldoDevedorEstimado * 100) / 100,
    percentualParcelaReduzida: pct,
  };
}

/**
 * Busca binária: crédito cuja parcela reduzida (sobre a integral) se aproxima do aporte mensal.
 * Não usa parcela integral como alvo, salvo quando percentual = 100%.
 */
export function estimarCreditoConsorcioPorParcela(
  input: EstimarCreditoPorParcelaInput,
): EstimarCreditoPorParcelaResult | null {
  const alvo = Math.max(0, input.parcelaDesejada);
  const prazo = Math.max(1, Math.floor(input.prazoMeses));
  if (alvo <= 0 || prazo <= 0) return null;

  const base: EstimarCreditoPorParcelaInput = { ...input, prazoMeses: prazo };

  let lo = 1_000;
  let hi = 50_000_000;
  while (parcelaReduzidaComparacaoAplicacao(hi, base) < alvo && hi < 200_000_000) {
    hi *= 2;
  }
  if (parcelaReduzidaComparacaoAplicacao(lo, base) > alvo) {
    return resultadoParaCredito(lo, base);
  }

  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    const p = parcelaReduzidaComparacaoAplicacao(mid, base);
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
