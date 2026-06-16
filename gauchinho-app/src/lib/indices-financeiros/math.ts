/** Converte taxa anual (% a.a.) em taxa mensal (% a.m.). */
export function taxaAnualParaMensalPercentual(taxaAnualPercentual: number): number {
  const a = taxaAnualPercentual / 100;
  if (a === 0) return 0;
  const m = Math.pow(1 + a, 1 / 12) - 1;
  return Math.round(m * 10000) / 100;
}

export function taxaMensalParaAnualPercentual(taxaMensalPercentual: number): number {
  const m = taxaMensalPercentual / 100;
  if (m === 0) return 0;
  const a = Math.pow(1 + m, 12) - 1;
  return Math.round(a * 10000) / 100;
}

export function parseDataBr(data: string): string | null {
  const m = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}
