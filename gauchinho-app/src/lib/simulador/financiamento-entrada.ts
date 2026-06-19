import type { FinanciamentoConfig } from "@/lib/config/defaults";

/** Valor inicial de entrada no simulador completo (até alinhar com config explícita). */
export const ENTRADA_FIN_SIMULADOR_PADRAO_VALOR = 100_000;

/** Entrada sugerida para preview/home — mesma regra do estado inicial do simulador completo. */
export function entradaPadraoFinanciamento(valorBem: number, fin: FinanciamentoConfig): number {
  const valor = Math.max(0, valorBem);
  const pct = Math.max(0, fin.entradaMinimaSugeridaPercentual ?? 0);
  if (pct > 0) {
    return Math.min(valor, Math.round(valor * (pct / 100)));
  }
  return Math.min(valor, ENTRADA_FIN_SIMULADOR_PADRAO_VALOR);
}

export function taxaFinanciamentoEfetiva(fin: FinanciamentoConfig): number | null {
  const t = fin.taxaMensalPadrao;
  if (t == null || !Number.isFinite(t) || t <= 0) return null;
  return t;
}

/** Taxa usada nos cálculos (estado do simulador + fallback da config). */
export function taxaMensalFinanciamentoCalculo(
  taxaInformada: number,
  fin: FinanciamentoConfig,
): number {
  return (
    taxaFinanciamentoEfetiva({ ...fin, taxaMensalPadrao: taxaInformada }) ??
    taxaFinanciamentoEfetiva(fin) ??
    1
  );
}

/** Garante valor financiado > 0 quando o bem tem valor positivo. */
export function entradaFinanciamentoParaCalculo(valorBem: number, entrada: number): number {
  const v = Math.max(0, valorBem);
  const e = Math.max(0, entrada);
  if (v <= 0) return 0;
  if (e >= v) return Math.max(0, v - 0.01);
  return e;
}
