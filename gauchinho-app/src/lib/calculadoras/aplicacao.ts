export type AplicacaoMensalInput = {
  valorInicial: number;
  aporteMensal: number;
  taxaMensalPercentual: number;
  prazoMeses: number;
};

export type AplicacaoMensalResult = {
  totalInvestido: number;
  rendimentoEstimado: number;
  valorFuturo: number;
  evolucaoResumida: Array<{ mes: number; saldo: number }>;
};

export function calcularAplicacaoMensal(input: AplicacaoMensalInput): AplicacaoMensalResult {
  const n = Math.max(0, Math.floor(input.prazoMeses));
  const taxa = input.taxaMensalPercentual / 100;
  const aporte = Math.max(0, input.aporteMensal);
  const inicial = Math.max(0, input.valorInicial);

  const valorFuturo = valorFuturoAplicacao(inicial, aporte, taxa, n);
  const totalInvestido = inicial + aporte * n;
  const rendimentoEstimado = valorFuturo - totalInvestido;

  const evolucaoResumida: Array<{ mes: number; saldo: number }> = [];
  const pontos = n <= 6 ? n : 6;
  for (let i = 0; i <= pontos; i++) {
    const mes = pontos === 0 ? 0 : Math.round((n * i) / pontos);
    const saldo = valorFuturoAplicacao(inicial, aporte, taxa, mes);
    evolucaoResumida.push({ mes, saldo: Math.round(saldo * 100) / 100 });
  }

  return {
    totalInvestido: Math.round(totalInvestido * 100) / 100,
    rendimentoEstimado: Math.round(rendimentoEstimado * 100) / 100,
    valorFuturo: Math.round(valorFuturo * 100) / 100,
    evolucaoResumida,
  };
}

function valorFuturoAplicacao(
  inicial: number,
  aporte: number,
  taxa: number,
  n: number,
): number {
  if (n <= 0) return inicial;
  if (taxa === 0) return inicial + aporte * n;
  const fator = Math.pow(1 + taxa, n);
  return inicial * fator + aporte * ((fator - 1) / taxa);
}
