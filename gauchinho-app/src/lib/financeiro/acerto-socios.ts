export type AcertoSocios = {
  debitoEmpresa: number;
  cotaIndividual: number;
  diferencaPagamentos: number;
  transferenciaParaEqualizar: number;
  despesaAdicionalParaEqualizar: number;
  socioCredor: "A" | "B" | null;
};

/**
 * A dívida é da empresa e pertence 50% a cada sócio.
 * Uma transferência entre os sócios corrige os dois saldos simultaneamente,
 * por isso basta metade da diferença. Se o acerto for feito com novas
 * despesas, o sócio que pagou menos precisa pagar a diferença inteira.
 */
export function calcularAcertoSocios(pagoA: number, pagoB: number): AcertoSocios {
  const a = Math.max(0, Number.isFinite(pagoA) ? pagoA : 0);
  const b = Math.max(0, Number.isFinite(pagoB) ? pagoB : 0);
  const debitoEmpresa = a + b;
  const diferencaPagamentos = Math.abs(a - b);
  return {
    debitoEmpresa,
    cotaIndividual: debitoEmpresa / 2,
    diferencaPagamentos,
    transferenciaParaEqualizar: diferencaPagamentos / 2,
    despesaAdicionalParaEqualizar: diferencaPagamentos,
    socioCredor: a === b ? null : a > b ? "A" : "B",
  };
}
