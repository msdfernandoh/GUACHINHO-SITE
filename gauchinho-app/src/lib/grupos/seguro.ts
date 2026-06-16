/** Converte valor cadastrado (0,0004 ou 1 para 1%) em fator multiplicador sobre o saldo. */
export function fatorSeguroGrupo(valor: number | null | undefined): number {
  const v = valor != null && Number.isFinite(valor) ? valor : 0;
  if (v <= 0) return 0;
  if (v >= 0.1) return v / 100;
  return v;
}

export function parseSeguroInput(raw: string): number {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}
