/**
 * Custo do plano diluído — modelo comercial simples da proposta.
 *
 * Não é "custo efetivo" (CET). É a diluição linear das taxas do consórcio no prazo:
 *   base   = taxa de administração + fundo de reserva  (ex.: 20% + 2% = 22%)
 *   ao mês = base ÷ prazo em meses                      (ex.: 22% ÷ 220 = 0,10%)
 *   ao ano = custo ao mês × 12                          (ex.: 0,10% × 12 = 1,20%)
 */
export type CustoPlanoDiluido = {
  /** taxa de administração + fundo de reserva, em pontos percentuais */
  basePercentual: number;
  /** custo diluído ao mês, em pontos percentuais */
  percentualMes: number;
  /** custo diluído ao ano, em pontos percentuais */
  percentualAno: number;
};

export function calcularCustoDiluido(
  taxaAdministrativaPercentual: number | null | undefined,
  fundoReservaPercentual: number | null | undefined,
  prazoMeses: number | null | undefined,
): CustoPlanoDiluido {
  const taxaAdm = num(taxaAdministrativaPercentual);
  const fundo = num(fundoReservaPercentual);
  const prazo = num(prazoMeses);
  const basePercentual = round(taxaAdm + fundo, 4);
  if (prazo <= 0) {
    return { basePercentual, percentualMes: 0, percentualAno: 0 };
  }
  const percentualMes = round(basePercentual / prazo, 4);
  const percentualAno = round(percentualMes * 12, 4);
  return { basePercentual, percentualMes, percentualAno };
}

/** Formata um percentual (ex.: 0,1) como "0,10%". */
export function fmtPercent(value: number | null | undefined, casas = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
}

function num(v: number | null | undefined): number {
  return v != null && Number.isFinite(v) ? v : 0;
}

function round(v: number, casas: number): number {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
}
