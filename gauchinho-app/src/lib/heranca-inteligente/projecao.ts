/**
 * Projeção ilustrativa do Método Herança Inteligente: carta de R$ 100 mil com
 * parcela inicial de R$ 375, reajuste anual de 8% (INCC de referência) e, após
 * a contemplação, o crédito aplicado a 1% ao mês até o fim do 16º ano.
 */
export const HERANCA_CREDITO_INICIAL = 100_000;
export const HERANCA_PARCELA_INICIAL = 375;
export const HERANCA_REAJUSTE_ANUAL = 0.08;
export const HERANCA_RENDIMENTO_MENSAL = 0.01;
export const HERANCA_ANOS = 16;

export type LinhaProjecao = {
  ano: number;
  parcelaMensal: number;
  creditoNoAno: number;
  creditoNoFim: number;
};

const arred = (v: number) => Math.round(v * 100) / 100;

export function projecaoAno(ano: number): LinhaProjecao {
  const fator = Math.pow(1 + HERANCA_REAJUSTE_ANUAL, ano - 1);
  const creditoNoAno = HERANCA_CREDITO_INICIAL * fator;
  const mesesAplicado = 12 * (HERANCA_ANOS - ano);
  return {
    ano,
    parcelaMensal: arred(HERANCA_PARCELA_INICIAL * fator),
    creditoNoAno: arred(creditoNoAno),
    creditoNoFim: arred(creditoNoAno * Math.pow(1 + HERANCA_RENDIMENTO_MENSAL, mesesAplicado)),
  };
}

export function tabelaProjecao(): LinhaProjecao[] {
  return Array.from({ length: HERANCA_ANOS }, (_, i) => projecaoAno(i + 1));
}

/** Valor por dia da parcela inicial (R$ 375 / 30 ≈ R$ 12,50). */
export const HERANCA_POR_DIA = HERANCA_PARCELA_INICIAL / 30;
