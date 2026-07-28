/**
 * Converte valor cadastrado em fator mensal sobre o saldo (planilha: ex. 0,0004 = 0,04% a.m.).
 *
 * Aceita:
 * - fator direto: `0,0004`
 * - percentual a.m. em pontos: `0,04` (= 0,04%) → `0,0004`
 * - percentual inteiro: `1` (= 1% a.m.) → `0,01`
 */
export function fatorSeguroGrupo(valor: number | null | undefined): number {
  const v = valor != null && Number.isFinite(valor) ? Number(valor) : 0;
  if (v <= 0) return 0;
  // Já na escala do fator da planilha (0,0004 etc.)
  if (v < 0.01) return v;
  // 0,01–0,099 ou >= 0,1: percentual a.m. em pontos (0,04 → 0,0004; 1 → 0,01)
  return v / 100;
}

/** Faz parse do campo do formulário; remove % e normaliza vírgula. */
export function parseSeguroInput(raw: string): number {
  const t = raw.trim().replace(/\s/g, "").replace(/%/g, "").replace(",", ".");
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

/** Persiste sempre o fator multiplicador (0,0004), evitando ambiguidade no banco. */
export function canonicalSeguroFator(valor: number | null | undefined): number {
  return Math.round(fatorSeguroGrupo(valor) * 1_000_000) / 1_000_000;
}

export function formatSeguroFatorLabel(valor: number | null | undefined): string {
  const f = fatorSeguroGrupo(valor);
  if (f <= 0) return "sem seguro";
  const pctAm = f * 100;
  const pctStr = pctAm.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
  const fatorStr = f.toLocaleString("pt-BR", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
  return `${pctStr}% a.m. (fator ${fatorStr})`;
}
