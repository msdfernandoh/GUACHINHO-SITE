export type AplicacaoMensalInput = {
  valorInicial: number;
  aporteMensal: number;
  taxaMensalPercentual: number;
  prazoMeses: number;
  /** Reajuste anual do aporte (% a.a.), aplicado a cada 12 meses. */
  aumentoAnualAportePercentual?: number;
};

export type AplicacaoMensalResult = {
  totalInvestido: number;
  rendimentoEstimado: number;
  valorFuturo: number;
  evolucaoResumida: Array<{ mes: number; saldo: number }>;
  aporteMensalInicial: number;
  aumentoAnualAportePercentual: number;
};

export function aporteMensalNoMes(
  aporteInicial: number,
  aumentoAnualPercentual: number,
  mes: number,
): number {
  if (mes < 1) return aporteInicial;
  const anoAtual = Math.floor((mes - 1) / 12);
  return aporteInicial * Math.pow(1 + aumentoAnualPercentual / 100, anoAtual);
}

export function calcularAplicacaoMensal(input: AplicacaoMensalInput): AplicacaoMensalResult {
  const n = Math.max(0, Math.floor(input.prazoMeses));
  const taxa = input.taxaMensalPercentual / 100;
  const aporteInicial = Math.max(0, input.aporteMensal);
  const inicial = Math.max(0, input.valorInicial);
  const reajusteAporte = Math.max(0, input.aumentoAnualAportePercentual ?? 0);

  let saldo = inicial;
  let totalAportes = 0;
  for (let mes = 1; mes <= n; mes++) {
    const aporteMes = aporteMensalNoMes(aporteInicial, reajusteAporte, mes);
    saldo = saldo * (1 + taxa) + aporteMes;
    totalAportes += aporteMes;
  }

  const valorFuturo = n === 0 ? inicial : saldo;
  const totalInvestido = inicial + totalAportes;
  const rendimentoEstimado = valorFuturo - totalInvestido;

  const evolucaoResumida: Array<{ mes: number; saldo: number }> = [];
  const pontos = n <= 6 ? n : 6;
  for (let i = 0; i <= pontos; i++) {
    const mes = pontos === 0 ? 0 : Math.round((n * i) / pontos);
    const saldoPonto = mes === 0 ? inicial : valorFuturoAplicacao(inicial, aporteInicial, taxa, mes, reajusteAporte);
    evolucaoResumida.push({ mes, saldo: Math.round(saldoPonto * 100) / 100 });
  }

  return {
    totalInvestido: Math.round(totalInvestido * 100) / 100,
    rendimentoEstimado: Math.round(rendimentoEstimado * 100) / 100,
    valorFuturo: Math.round(valorFuturo * 100) / 100,
    evolucaoResumida,
    aporteMensalInicial: aporteInicial,
    aumentoAnualAportePercentual: reajusteAporte,
  };
}

function valorFuturoAplicacao(
  inicial: number,
  aporteInicial: number,
  taxa: number,
  n: number,
  aumentoAnualAportePercentual = 0,
): number {
  if (n <= 0) return inicial;
  if (aumentoAnualAportePercentual > 0) {
    let saldo = inicial;
    for (let mes = 1; mes <= n; mes++) {
      const aporte = aporteMensalNoMes(aporteInicial, aumentoAnualAportePercentual, mes);
      if (taxa === 0) saldo += aporte;
      else saldo = saldo * (1 + taxa) + aporte;
    }
    return saldo;
  }
  if (taxa === 0) return inicial + aporteInicial * n;
  const fator = Math.pow(1 + taxa, n);
  return inicial * fator + aporteInicial * ((fator - 1) / taxa);
}
