/**
 * Cálculos de consórcio — única fonte (UI, projeção e PDF consomem estes exports).
 */

import { fatorSeguroGrupo } from "@/lib/grupos/seguro";



export type ModoLanceInput = "percent" | "valor";



export type EntradaConsorcio = {

  valorCredito: number;

  prazoMeses: number;

  taxaAdministrativaPercentual: number;

  fundoReservaPercentual: number;

  seguroPrestamistaPercentual: number;

  entrada?: number;

  lanceEmbutido?: number;

  reajusteAnualCredito?: number;

  correcaoAnualParcela?: number;

  percentualParcelaInicial?: number;

};



export type ResultadoConsorcio = {

  valorCredito: number;

  prazoMeses: number;

  parcelaIntegral: number;

  /** Amortização mensal (sem seguro prestamista). */
  parcelaAmortizacao: number;

  parcelaEstimada: number;

  percentualParcelaInicial: number;

  taxaAdministrativaTotal: number;

  fundoReservaTotal: number;

  seguroMensal: number;

  seguroTotalEstimado: number;

  valorTotalEstimado: number;

  /** Crédito + taxa administrativa + fundo de reserva (total estimado do plano). */
  saldoDevedorEstimado: number;

  entrada: number;

  lanceEmbutido: number;

};



export type ResultadoContemplacaoMes1 = ResultadoConsorcio & {

  primeiraParcela: number;

  saldoDevedorInicial: number;

  saldoDevedorFinal: number;

  parcelasRestantes: number;

  parcelaPosContemplacao: number;

  lanceTotal: number;

  custoAdmEfetivoMensalPercentual: number;

  custoAdmEfetivoAnualPercentual: number;

  saldoDevedorZerado: boolean;

  avisoSaldo: string | null;

};



export function calcularTaxaAdministrativaTotal(credito: number, taxaPercentual: number): number {

  return credito * (taxaPercentual / 100);

}



export function calcularFundoReservaTotal(credito: number, fundoPercentual: number): number {

  return credito * (fundoPercentual / 100);

}



export function calcularSeguroPrestamistaMensal(
  saldoDevedor: number,
  credito: number,
  seguroInput: number,
): number {
  if (!seguroInput) return 0;
  /** Fator mensal sobre saldo (planilha grupos — ex. 0,0004). */
  if (seguroInput <= 0.001) {
    const fator = fatorSeguroGrupo(seguroInput);
    return Math.round(saldoDevedor * fator * 100) / 100;
  }
  return Math.round(((credito * seguroInput) / 100 / 12) * 100) / 100;
}



export function calcularSeguroPrestamistaTotal(
  saldoDevedor: number,
  credito: number,
  seguroInput: number,
  prazoMeses: number,
): number {
  return calcularSeguroPrestamistaMensal(saldoDevedor, credito, seguroInput) * prazoMeses;
}



export function calcularParcelaBaseConsorcio(

  credito: number,

  prazoMeses: number,

  taxaAdmTotal: number,

  fundoTotal: number,

  lanceProprio = 0,

  lanceEmbutido = 0,

): number {

  const prazo = Math.max(prazoMeses, 1);

  const baseAmortizavel = credito + taxaAdmTotal + fundoTotal - lanceProprio - lanceEmbutido;

  return baseAmortizavel / prazo;

}



export function calcularParcelaComSeguro(parcelaBase: number, seguroMensal: number): number {

  return parcelaBase + seguroMensal;

}



export function calcularParcelaReduzida(parcelaIntegral: number, percentualParcela: number): number {

  const pct = Math.max(0, Math.min(percentualParcela, 100));

  return parcelaIntegral * (pct / 100);

}



export function calcularValorTotalConsorcio(

  parcelaMensal: number,

  prazoMeses: number,

  lanceProprio = 0,

  lanceEmbutido = 0,

): number {

  return parcelaMensal * prazoMeses + lanceProprio + lanceEmbutido;

}



export function calcularTotalPagoAcumulado(parcelaMensal: number, mesesPagos: number): number {

  return parcelaMensal * Math.max(mesesPagos, 0);

}



export function calcularCustoEfetivoMensal(

  taxaAdministrativaPercentual: number,

  prazoMeses: number,

): number {

  return taxaAdministrativaPercentual / Math.max(prazoMeses, 1);

}



export function calcularCustoEfetivoAnual(custoMensalPercentual: number): number {

  return custoMensalPercentual * 12;

}



export function calcularLancePorTipo(

  credito: number,

  valorOuPercentual: number,

  modo: ModoLanceInput,

): number {

  const v = Math.max(0, valorOuPercentual);

  if (modo === "percent") return credito * (Math.min(v, 100) / 100);

  return v;

}



export function calcularSaldoDevedorInicial(

  parcelaIntegral: number,

  prazoMeses: number,

  lanceProprio: number,

  lanceEmbutido: number,

): number {

  return parcelaIntegral * Math.max(prazoMeses, 1) + lanceProprio + lanceEmbutido;

}



export function calcularSaldoDevedorFinal(

  saldoDevedorInicial: number,

  primeiraParcela: number,

  lanceProprio: number,

  lanceEmbutido: number,

): { saldo: number; zerado: boolean } {

  const bruto =

    saldoDevedorInicial - primeiraParcela - Math.max(0, lanceProprio) - Math.max(0, lanceEmbutido);

  if (bruto <= 0) return { saldo: 0, zerado: bruto < 0 };

  return { saldo: bruto, zerado: false };

}



export function calcularParcelasRestantesAposContemplacao(prazoMeses: number): number {

  return Math.max(prazoMeses - 1, 0);

}



export function calcularParcelaPosContemplacao(

  saldoDevedorFinal: number,

  parcelasRestantes: number,

): number {

  if (parcelasRestantes <= 0) return 0;

  return saldoDevedorFinal / parcelasRestantes;

}



export function calcularTotalPagoPrimeiroAnoAposContemplacao(

  primeiraParcela: number,

  parcelaPosContemplacao: number,

): number {

  return primeiraParcela + parcelaPosContemplacao * 11;

}



export function calcularParcelaConsorcio(entrada: EntradaConsorcio): ResultadoConsorcio {

  const credito = entrada.valorCredito;

  const prazo = Math.max(entrada.prazoMeses, 1);

  const taxaAdministrativaTotal = calcularTaxaAdministrativaTotal(

    credito,

    entrada.taxaAdministrativaPercentual,

  );

  const fundoReservaTotal = calcularFundoReservaTotal(credito, entrada.fundoReservaPercentual);

  const saldoDevedorEstimado = credito + taxaAdministrativaTotal + fundoReservaTotal;

  const seguroMensal = calcularSeguroPrestamistaMensal(
    saldoDevedorEstimado,
    credito,
    entrada.seguroPrestamistaPercentual,
  );

  const seguroTotalEstimado = seguroMensal * prazo;

  const entradaValor = Math.max(0, entrada.entrada ?? 0);

  const lanceEmbutido = Math.max(0, entrada.lanceEmbutido ?? 0);

  const baseAmortizavel = Math.max(
    saldoDevedorEstimado - entradaValor - lanceEmbutido,
    0,
  );

  const parcelaBase = baseAmortizavel / prazo;
  const parcelaAmortizacao = parcelaBase;
  const parcelaIntegral = calcularParcelaComSeguro(parcelaBase, seguroMensal);
  const percentualParcelaInicial = entrada.percentualParcelaInicial ?? 100;
  const parcelaEstimada =
    calcularParcelaReduzida(parcelaBase, percentualParcelaInicial) + seguroMensal;

  const valorTotalEstimado = saldoDevedorEstimado;



  return {

    valorCredito: credito,

    prazoMeses: prazo,

    parcelaIntegral,

    parcelaAmortizacao,

    parcelaEstimada,

    percentualParcelaInicial,

    taxaAdministrativaTotal,

    fundoReservaTotal,

    seguroMensal,

    seguroTotalEstimado,

    valorTotalEstimado,

    saldoDevedorEstimado,

    entrada: entradaValor,

    lanceEmbutido,

  };

}



export function calcularContemplacaoPrimeiroMes(

  entrada: EntradaConsorcio,

): ResultadoContemplacaoMes1 {

  const base = calcularParcelaConsorcio(entrada);

  const lanceProprio = base.entrada;

  const lanceEmbutido = base.lanceEmbutido;

  const lanceTotal = lanceProprio + lanceEmbutido;

  const primeiraParcela = base.parcelaEstimada;

  const saldoDevedorInicial = base.saldoDevedorEstimado;

  const { saldo: saldoDevedorFinal, zerado: saldoDevedorZerado } = calcularSaldoDevedorFinal(

    saldoDevedorInicial,

    primeiraParcela,

    lanceProprio,

    lanceEmbutido,

  );

  const parcelasRestantes = calcularParcelasRestantesAposContemplacao(base.prazoMeses);

  const parcelaPosContemplacao = calcularParcelaPosContemplacao(

    saldoDevedorFinal,

    parcelasRestantes,

  );

  const custoAdmEfetivoMensalPercentual = calcularCustoEfetivoMensal(

    entrada.taxaAdministrativaPercentual,

    base.prazoMeses,

  );

  const custoAdmEfetivoAnualPercentual = calcularCustoEfetivoAnual(

    custoAdmEfetivoMensalPercentual,

  );



  let avisoSaldo: string | null = null;

  if (saldoDevedorZerado) {

    avisoSaldo =

      "Lance e primeira parcela superam o saldo devedor inicial na simulação; saldo final ajustado para zero.";

  } else if (lanceTotal > saldoDevedorInicial) {

    avisoSaldo = "Lance total informado é maior que o saldo devedor inicial; revise os valores.";

  } else if (parcelasRestantes === 0) {

    avisoSaldo = "Prazo insuficiente para calcular parcelas restantes após contemplação.";

  }



  return {

    ...base,

    primeiraParcela,

    saldoDevedorInicial,

    saldoDevedorFinal,

    parcelasRestantes,

    parcelaPosContemplacao,

    lanceTotal,

    custoAdmEfetivoMensalPercentual,

    custoAdmEfetivoAnualPercentual,

    saldoDevedorZerado,

    avisoSaldo,

  };

}



export type LinhaProjecaoAnual = {

  ano: number;

  mesesPagosAcumulados: number;

  totalPagoAcumulado: number;

  creditoEstimadoReajustado: number;

  valorizacaoAcumuladaCredito: number;

  ganhoPatrimonialEstimado: number;

  parcelaEstimadaNoPeriodo: number;

  creditoLiquidoEstimado: number;

};



export function calcularCreditoReajustado(

  creditoInicial: number,

  reajusteAnualPercentual: number,

  anos: number,

): number {

  return creditoInicial * Math.pow(1 + reajusteAnualPercentual / 100, anos);

}



export function calcularGanhoPatrimonialEstimado(

  creditoReajustado: number,

  creditoInicial: number,

): number {

  return creditoReajustado - creditoInicial;

}



export function calcularParcelaNoAno(

  parcelaPosContemplacao: number,

  correcaoAnualParcelaPercentual: number,

  ano: number,

): number {

  const fator = Math.pow(1 + correcaoAnualParcelaPercentual / 100, Math.max(0, ano - 1));

  return parcelaPosContemplacao * fator;

}



function parcelaNoMesSimulacao(

  mes: number,

  primeiraParcela: number,

  parcelaPosContemplacao: number,

  correcaoAnualParcela: number,

): number {

  if (mes <= 1) return primeiraParcela;

  const mesesPosContemplacao = mes - 1;

  const anoPos = Math.floor(mesesPosContemplacao / 12) + 1;

  return calcularParcelaNoAno(parcelaPosContemplacao, correcaoAnualParcela, anoPos);

}



export function calcularProjecaoConsorcio(entrada: EntradaConsorcio): LinhaProjecaoAnual[] {

  const base = calcularParcelaConsorcio(entrada);

  const parcelaInicial = base.parcelaEstimada;

  const reajuste = entrada.reajusteAnualCredito ?? 0;

  const correcaoParcela = entrada.correcaoAnualParcela ?? 0;

  const lanceEmbutido = entrada.lanceEmbutido ?? 0;

  const creditoInicial = entrada.valorCredito;

  const prazo = base.prazoMeses;

  const anosTotais = Math.ceil(prazo / 12);

  const linhas: LinhaProjecaoAnual[] = [];

  let totalPagoRunning = 0;

  let mesesAcumulados = 0;



  for (let ano = 1; ano <= anosTotais; ano++) {

    const mesesEsteAno = Math.min(12, prazo - mesesAcumulados);

    if (mesesEsteAno <= 0) break;



    const parcelaNoPeriodo = calcularParcelaNoAno(parcelaInicial, correcaoParcela, ano);

    const pagoAno = parcelaNoPeriodo * mesesEsteAno;

    mesesAcumulados += mesesEsteAno;

    totalPagoRunning += pagoAno;



    const creditoEstimadoReajustado = calcularCreditoReajustado(creditoInicial, reajuste, ano);

    const valorizacaoAcumuladaCredito = calcularGanhoPatrimonialEstimado(

      creditoEstimadoReajustado,

      creditoInicial,

    );



    linhas.push({

      ano,

      mesesPagosAcumulados: mesesAcumulados,

      totalPagoAcumulado: totalPagoRunning,

      creditoEstimadoReajustado,

      valorizacaoAcumuladaCredito,

      ganhoPatrimonialEstimado: valorizacaoAcumuladaCredito,

      parcelaEstimadaNoPeriodo: parcelaNoPeriodo,

      creditoLiquidoEstimado: Math.max(0, creditoEstimadoReajustado - lanceEmbutido),

    });

  }



  return linhas;

}



export function formatarPercentualSimulador(valor: number, casas = 2): string {

  return `${valor.toLocaleString("pt-BR", {

    minimumFractionDigits: casas,

    maximumFractionDigits: casas,

  })}%`;

}


