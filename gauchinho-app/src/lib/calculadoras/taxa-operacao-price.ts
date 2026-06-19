import { calcularParcelaFinanciamento } from "@/lib/simulador/financiamento";

export type TaxaOperacaoInput = {
  valorCredito: number;
  parcela: number;
  prazoMeses: number;
};

export type TaxaOperacaoResult = {
  valorCredito: number;
  parcela: number;
  prazoMeses: number;
  taxaMensalPercentual: number;
  taxaAnualEquivalentePercentual: number;
  totalPago: number;
  jurosTotais: number;
};

export type TaxaOperacaoErro = {
  erro: string;
};

function parcelaPrice(valorFinanciado: number, taxaMensalPercentual: number, prazoMeses: number): number {
  return calcularParcelaFinanciamento({
    valorBem: valorFinanciado,
    entrada: 0,
    taxaMensalPercentual,
    prazoMeses,
  });
}

function taxaAnualEquivalente(taxaMensalPercentual: number): number {
  const i = taxaMensalPercentual / 100;
  return (Math.pow(1 + i, 12) - 1) * 100;
}

/**
 * Descobre a taxa mensal (Tabela Price) que reproduz a parcela informada.
 * Útil para comparar propostas de consórcio, financiamento ou crédito.
 */
export function calcularTaxaOperacaoPrice(
  input: TaxaOperacaoInput,
): TaxaOperacaoResult | TaxaOperacaoErro {
  const pv = Math.max(0, input.valorCredito);
  const pmt = Math.max(0, input.parcela);
  const n = Math.max(1, Math.floor(input.prazoMeses));

  if (pv <= 0) return { erro: "Informe o valor do crédito." };
  if (pmt <= 0) return { erro: "Informe o valor da parcela." };

  const parcelaZeroJuros = pv / n;
  if (pmt + 0.001 < parcelaZeroJuros) {
    return {
      erro: "A parcela é menor que a amortização linear (0% a.m.). Verifique os valores.",
    };
  }

  if (Math.abs(pmt - parcelaZeroJuros) < 0.01) {
    return {
      valorCredito: pv,
      parcela: pmt,
      prazoMeses: n,
      taxaMensalPercentual: 0,
      taxaAnualEquivalentePercentual: 0,
      totalPago: Math.round(pmt * n * 100) / 100,
      jurosTotais: Math.max(0, Math.round((pmt * n - pv) * 100) / 100),
    };
  }

  let lo = 0;
  let hi = 50;
  for (let k = 0; k < 96; k++) {
    const mid = (lo + hi) / 2;
    const p = parcelaPrice(pv, mid, n);
    if (p > pmt) hi = mid;
    else lo = mid;
  }

  const taxaMensalPercentual = Math.round(((lo + hi) / 2) * 10000) / 10000;
  const totalPago = Math.round(pmt * n * 100) / 100;
  const jurosTotais = Math.round((totalPago - pv) * 100) / 100;

  return {
    valorCredito: pv,
    parcela: pmt,
    prazoMeses: n,
    taxaMensalPercentual,
    taxaAnualEquivalentePercentual: Math.round(taxaAnualEquivalente(taxaMensalPercentual) * 100) / 100,
    totalPago,
    jurosTotais,
  };
}
