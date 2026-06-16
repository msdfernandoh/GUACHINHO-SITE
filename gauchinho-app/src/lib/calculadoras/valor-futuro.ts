export type ValorFuturoInput = {
  valorInicial: number;
  taxaMensalPercentual: number;
  prazoMeses: number;
};

export type ValorFuturoResult = {
  valorInicial: number;
  rendimentoEstimado: number;
  valorFuturo: number;
};

export function calcularValorFuturo(input: ValorFuturoInput): ValorFuturoResult {
  const n = Math.max(0, Math.floor(input.prazoMeses));
  const taxa = input.taxaMensalPercentual / 100;
  const inicial = Math.max(0, input.valorInicial);

  let valorFuturo = inicial;
  if (n > 0) {
    if (taxa === 0) {
      valorFuturo = inicial;
    } else {
      valorFuturo = inicial * Math.pow(1 + taxa, n);
    }
  }

  const rendimentoEstimado = valorFuturo - inicial;

  return {
    valorInicial: Math.round(inicial * 100) / 100,
    rendimentoEstimado: Math.round(rendimentoEstimado * 100) / 100,
    valorFuturo: Math.round(valorFuturo * 100) / 100,
  };
}
