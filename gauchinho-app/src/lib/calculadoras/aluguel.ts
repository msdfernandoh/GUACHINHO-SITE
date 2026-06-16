import type { IndicePublico } from "@/lib/indices-financeiros/types";

export type IndiceAluguelCodigo = "ipca" | "igpm" | "taxa_manual";

export type CorrecaoAluguelInput = {
  valorAtual: number;
  indice: IndiceAluguelCodigo;
  usarIndiceAtual: boolean;
  percentualManual: number;
  percentualIndice: number | null;
  periodoMeses: number;
  indiceMeta?: Pick<IndicePublico, "nome" | "data_referencia" | "ultima_atualizacao" | "usando_fallback">;
};

export type CorrecaoAluguelResult = {
  tipo_calculadora: "correcao_aluguel";
  valorAtual: number;
  indice: IndiceAluguelCodigo;
  percentualAplicado: number;
  valorReajuste: number;
  novoValor: number;
  diferencaMensal: number;
  diferencaAnual: number;
  data_referencia_indice: string | null;
  indiceLabel: string;
  usandoFallback: boolean;
};

export function calcularCorrecaoAluguel(input: CorrecaoAluguelInput): CorrecaoAluguelResult {
  const valorAtual = Math.max(0, input.valorAtual);
  const n = Math.max(1, Math.floor(input.periodoMeses));

  let percentualAplicado = input.percentualManual;
  if (input.usarIndiceAtual && input.percentualIndice != null && Number.isFinite(input.percentualIndice)) {
    percentualAplicado = input.percentualIndice;
  }

  let novoValor: number;
  if (n === 12 && (input.indice === "ipca" || input.indice === "igpm" || !input.usarIndiceAtual)) {
    novoValor = valorAtual * (1 + percentualAplicado / 100);
  } else {
    const taxaMensal = Math.pow(1 + percentualAplicado / 100, 1 / 12) - 1;
    novoValor = valorAtual * Math.pow(1 + taxaMensal, n);
    percentualAplicado = (Math.pow(novoValor / valorAtual, 12 / n) - 1) * 100;
    percentualAplicado = Math.round(percentualAplicado * 100) / 100;
  }

  const valorReajuste = novoValor - valorAtual;
  const diferencaMensal = valorReajuste;
  const diferencaAnual = diferencaMensal * 12;

  const labels: Record<IndiceAluguelCodigo, string> = {
    ipca: "IPCA",
    igpm: "IGP-M",
    taxa_manual: "Taxa manual",
  };

  return {
    tipo_calculadora: "correcao_aluguel",
    valorAtual: round2(valorAtual),
    indice: input.indice,
    percentualAplicado: round2(percentualAplicado),
    valorReajuste: round2(valorReajuste),
    novoValor: round2(novoValor),
    diferencaMensal: round2(diferencaMensal),
    diferencaAnual: round2(diferencaAnual),
    data_referencia_indice: input.indiceMeta?.data_referencia ?? null,
    indiceLabel: labels[input.indice],
    usandoFallback: input.indiceMeta?.usando_fallback ?? false,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
