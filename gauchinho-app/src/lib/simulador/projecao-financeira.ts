import type { EntradaConsorcio, LinhaProjecaoAnual } from "./consorcio";
import { calcularProjecaoConsorcio } from "./consorcio";

/** Crédito reajustado na linha da projeção após acumular pelo menos `mesesAlvo` meses (mesma regra da tabela do simulador). */
export function creditoReajustadoAposMesesNaProjecao(
  linhas: LinhaProjecaoAnual[],
  mesesAlvo: number,
): number | null {
  if (!linhas.length || mesesAlvo <= 0) return null;
  const linha = linhas.find((l) => l.mesesPagosAcumulados >= mesesAlvo);
  const alvo = linha ?? linhas[linhas.length - 1];
  return alvo?.creditoEstimadoReajustado ?? null;
}

/** Crédito reajustado ao final do prazo total do consórcio (última linha da projeção). */
export function creditoReajustadoFinalConsorcio(linhas: LinhaProjecaoAnual[]): number | null {
  if (!linhas.length) return null;
  return linhas[linhas.length - 1]?.creditoEstimadoReajustado ?? null;
}

export function calcularProjecaoComparativoConsorcio(entrada: EntradaConsorcio): LinhaProjecaoAnual[] {
  return calcularProjecaoConsorcio(entrada);
}
