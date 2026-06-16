import type { TipoTaxaCorrecao } from "./types";

export type CorrecaoValoresInput = {
  valorInicial: number;
  percentualTaxa: number;
  tipoTaxa: TipoTaxaCorrecao;
  prazoMeses: number;
};

export type CorrecaoValoresResult = {
  valorInicial: number;
  taxaMensalEfetivaPercentual: number;
  correcaoAcumulada: number;
  valorCorrigido: number;
};

export function taxaMensalFromInput(
  percentual: number,
  tipo: TipoTaxaCorrecao,
): number {
  const p = percentual / 100;
  if (tipo === "mensal") return p;
  if (p === 0) return 0;
  return Math.pow(1 + p, 1 / 12) - 1;
}

export function calcularCorrecaoValores(input: CorrecaoValoresInput): CorrecaoValoresResult {
  const n = Math.max(0, Math.floor(input.prazoMeses));
  const inicial = Math.max(0, input.valorInicial);
  const taxaMensal = taxaMensalFromInput(input.percentualTaxa, input.tipoTaxa);

  let valorCorrigido = inicial;
  if (n > 0) {
    if (taxaMensal === 0) {
      valorCorrigido = inicial;
    } else {
      valorCorrigido = inicial * Math.pow(1 + taxaMensal, n);
    }
  }

  const correcaoAcumulada = valorCorrigido - inicial;

  return {
    valorInicial: Math.round(inicial * 100) / 100,
    taxaMensalEfetivaPercentual: Math.round(taxaMensal * 10000) / 100,
    correcaoAcumulada: Math.round(correcaoAcumulada * 100) / 100,
    valorCorrigido: Math.round(valorCorrigido * 100) / 100,
  };
}
