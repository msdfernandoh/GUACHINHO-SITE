import type { EntradaConsorcio } from "./consorcio";
import { calcularParcelaConsorcio } from "./consorcio";

export type LinhaProjecaoAnual = {
  ano: number;
  mesesPagosAcumulados: number;
  totalPagoAcumulado: number;
  creditoEstimadoReajustado: number;
  valorizacaoAcumuladaCredito: number;
  ganhoPatrimonialEstimado: number;
  parcelaEstimadaNoPeriodo: number;
};

export function calcularCreditoReajustado(
  creditoInicial: number,
  reajusteAnualPercentual: number,
  anos: number,
): number {
  return creditoInicial * Math.pow(1 + reajusteAnualPercentual / 100, anos);
}

export function calcularTotalPagoAcumulado(
  parcelaMensal: number,
  meses: number,
  entrada = 0,
  lanceEmbutido = 0,
): number {
  return parcelaMensal * meses + entrada + lanceEmbutido;
}

export function calcularGanhoPatrimonialEstimado(
  creditoReajustado: number,
  totalPagoAcumulado: number,
): number {
  return creditoReajustado - totalPagoAcumulado;
}

export function gerarProjecaoAnoAno(
  entrada: EntradaConsorcio,
): LinhaProjecaoAnual[] {
  const resultado = calcularParcelaConsorcio(entrada);
  const prazo = entrada.prazoMeses;
  const reajuste = entrada.reajusteAnualCredito ?? 0;
  const correcaoParcela = entrada.correcaoAnualParcela ?? 0;
  const anosTotais = Math.ceil(prazo / 12);
  const linhas: LinhaProjecaoAnual[] = [];
  let totalPagoRunning = resultado.entrada + resultado.lanceEmbutido;
  let mesesAcumulados = 0;

  for (let ano = 1; ano <= anosTotais; ano++) {
    const mesesEsteAno = Math.min(12, prazo - mesesAcumulados);
    if (mesesEsteAno <= 0) break;
    mesesAcumulados += mesesEsteAno;
    const parcelaNoPeriodo =
      resultado.parcelaEstimada *
      Math.pow(1 + correcaoParcela / 100, Math.max(ano - 1, 0));
    totalPagoRunning += parcelaNoPeriodo * mesesEsteAno;
    const creditoEstimadoReajustado = calcularCreditoReajustado(
      entrada.valorCredito,
      reajuste,
      ano,
    );
    const valorizacaoAcumuladaCredito =
      creditoEstimadoReajustado - entrada.valorCredito;
    const ganhoPatrimonialEstimado = calcularGanhoPatrimonialEstimado(
      creditoEstimadoReajustado,
      totalPagoRunning,
    );

    linhas.push({
      ano,
      mesesPagosAcumulados: mesesAcumulados,
      totalPagoAcumulado: totalPagoRunning,
      creditoEstimadoReajustado,
      valorizacaoAcumuladaCredito,
      ganhoPatrimonialEstimado,
      parcelaEstimadaNoPeriodo: parcelaNoPeriodo,
    });
  }

  return linhas;
}

export function resumoProjecaoAnos(
  linhas: LinhaProjecaoAnual[],
  anos: number[],
): LinhaProjecaoAnual[] {
  return anos
    .map((a) => linhas.find((l) => l.ano === a))
    .filter((l): l is LinhaProjecaoAnual => !!l);
}
