/**
 * Percentuais de grupo (taxa adm, fundo, parcela reduzida, lance): podem vir como
 * pontos (22 = 22%) ou fração (0.22 = 22%).
 */
export function normalizarPercentualGrupo(valor: number | null | undefined): number {
  const v = valor != null && Number.isFinite(valor) ? valor : 0;
  if (v <= 0) return 0;
  if (v >= 1) return v;
  return Math.round(v * 10000) / 100;
}
