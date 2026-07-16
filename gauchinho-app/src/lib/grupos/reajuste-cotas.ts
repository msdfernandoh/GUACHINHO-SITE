/** Reajuste anual de crédito/parcela das cotas (marcos 12/24/36…). */

export type CotaReajusteBase = {
  id: string;
  valor_credito: number;
  valor_parcela: number | null;
  parcela_integral?: number | null;
  parcela_reduzida?: number | null;
  saldo_devedor?: number | null;
  ordem?: number | null;
};

export type CotaReajustePreview = {
  id: string;
  valor_credito_atual: number;
  valor_parcela_atual: number;
  valor_credito_novo: number;
  valor_parcela_nova: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function parcelaEfetivaCota(c: {
  valor_parcela?: number | null;
  parcela_reduzida?: number | null;
  parcela_integral?: number | null;
}): number {
  const v = c.valor_parcela ?? c.parcela_reduzida ?? c.parcela_integral ?? 0;
  return Number.isFinite(v) ? Number(v) : 0;
}

/** Fator a partir do percentual (ex.: 5 → 1.05; -2 → 0.98). */
export function fatorFromPercentual(percentual: number): number {
  if (!Number.isFinite(percentual)) return 1;
  return 1 + percentual / 100;
}

/** Percentual implícito entre valor antigo e novo. */
export function percentualFromFator(fator: number): number {
  if (!Number.isFinite(fator) || fator <= 0) return 0;
  return round2((fator - 1) * 100);
}

export function aplicarPercentualNasCotas(
  cotas: CotaReajusteBase[],
  percentual: number,
): CotaReajustePreview[] {
  const fator = fatorFromPercentual(percentual);
  return cotas.map((c) => {
    const creditoAtual = Number(c.valor_credito) || 0;
    const parcelaAtual = parcelaEfetivaCota(c);
    return {
      id: c.id,
      valor_credito_atual: creditoAtual,
      valor_parcela_atual: parcelaAtual,
      valor_credito_novo: round2(creditoAtual * fator),
      valor_parcela_nova: round2(parcelaAtual * fator),
    };
  });
}

/**
 * A partir do crédito novo de uma cota, calcula o fator e reaplica em todas
 * (crédito e parcela) a partir dos valores atuais originais.
 */
export function aplicarFatorCreditoEmTodas(
  cotas: CotaReajusteBase[],
  cotaId: string,
  creditoNovo: number,
): { percentual: number; linhas: CotaReajustePreview[] } {
  const base = cotas.find((c) => c.id === cotaId);
  const atual = Number(base?.valor_credito) || 0;
  const fator = atual > 0 && Number.isFinite(creditoNovo) ? creditoNovo / atual : 1;
  const percentual = percentualFromFator(fator);
  return { percentual, linhas: aplicarPercentualNasCotas(cotas, percentual) };
}

/**
 * A partir da parcela nova de uma cota, calcula o fator e reaplica em todas.
 */
export function aplicarFatorParcelaEmTodas(
  cotas: CotaReajusteBase[],
  cotaId: string,
  parcelaNova: number,
): { percentual: number; linhas: CotaReajustePreview[] } {
  const base = cotas.find((c) => c.id === cotaId);
  const atual = parcelaEfetivaCota(base ?? { valor_parcela: 0 });
  const fator = atual > 0 && Number.isFinite(parcelaNova) ? parcelaNova / atual : 1;
  const percentual = percentualFromFator(fator);
  return { percentual, linhas: aplicarPercentualNasCotas(cotas, percentual) };
}
