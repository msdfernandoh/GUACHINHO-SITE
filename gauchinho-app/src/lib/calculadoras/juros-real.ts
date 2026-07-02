import { calcularParcelaFinanciamento } from "@/lib/simulador/financiamento";

export type EntradaTaxaReal = {
  valorFinanciado: number;
  parcela: number;
  prazoMeses: number;
};

export type ResultadoTaxaReal =
  | {
      ok: true;
      valorFinanciado: number;
      parcela: number;
      prazoMeses: number;
      totalPago: number;
      jurosTotais: number;
      taxaMensalPercentual: number;
      taxaAnualPercentual: number;
    }
  | {
      ok: false;
      motivo: string;
    };

function parcelaPrice(pv: number, i: number, n: number): number {
  if (n <= 0 || pv <= 0) return 0;
  if (i <= 0) return pv / n;
  const fator = (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
  return pv * fator;
}

/** Resolve taxa mensal (decimal) por busca binária na Tabela Price. */
export function calcularTaxaRealFinanciamento(entrada: EntradaTaxaReal): ResultadoTaxaReal {
  const pv = Math.max(0, entrada.valorFinanciado);
  const pmt = Math.max(0, entrada.parcela);
  const n = Math.max(1, Math.round(entrada.prazoMeses));

  if (pv <= 0 || pmt <= 0) {
    return { ok: false, motivo: "Informe valor financiado e parcela maiores que zero." };
  }

  const parcelaSemJuros = pv / n;
  if (pmt <= parcelaSemJuros + 0.0001) {
    return {
      ok: false,
      motivo: "A parcela informada é baixa demais para haver juros neste prazo (taxa zero ou inválida).",
    };
  }

  let lo = 0;
  let hi = 0.5;
  while (parcelaPrice(pv, hi, n) < pmt && hi < 2) {
    hi *= 2;
  }
  if (parcelaPrice(pv, hi, n) < pmt) {
    return { ok: false, motivo: "Não foi possível estimar a taxa com estes valores." };
  }

  for (let step = 0; step < 80; step++) {
    const mid = (lo + hi) / 2;
    const p = parcelaPrice(pv, mid, n);
    if (p > pmt) hi = mid;
    else lo = mid;
  }

  const i = (lo + hi) / 2;
  const taxaMensalPercentual = Math.round(i * 10000) / 100;
  const taxaAnualPercentual = Math.round((Math.pow(1 + i, 12) - 1) * 10000) / 100;
  const totalPago = pmt * n;
  const jurosTotais = Math.max(0, totalPago - pv);

  if (!Number.isFinite(taxaMensalPercentual) || !Number.isFinite(taxaAnualPercentual)) {
    return { ok: false, motivo: "Não foi possível calcular a taxa." };
  }

  return {
    ok: true,
    valorFinanciado: pv,
    parcela: pmt,
    prazoMeses: n,
    totalPago,
    jurosTotais,
    taxaMensalPercentual,
    taxaAnualPercentual,
  };
}

/** Atalho com valor do bem e entrada opcional. */
export function calcularTaxaRealDoBem(
  valorBem: number,
  entrada: number,
  parcela: number,
  prazoMeses: number,
): ResultadoTaxaReal {
  const valorFinanciado = Math.max(0, valorBem - Math.max(0, entrada));
  return calcularTaxaRealFinanciamento({ valorFinanciado, parcela, prazoMeses });
}
