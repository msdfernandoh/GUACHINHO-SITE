import { describe, expect, it } from "vitest";
import { calcularCreditoReajustado, calcularProjecaoConsorcio } from "./consorcio";
import { estimarCreditoConsorcioPorParcela } from "./estimar-credito-por-parcela";
import {
  calcularProjecaoComparativoConsorcio,
  creditoReajustadoAposMesesNaProjecao,
  creditoReajustadoFinalConsorcio,
} from "./projecao-financeira";

describe("projecao-financeira — alinhamento simulador", () => {
  it("crédito reajustado no período usa linha da projeção anual", () => {
    const est = estimarCreditoConsorcioPorParcela({
      parcelaDesejada: 500,
      prazoMeses: 220,
      percentualParcelaReduzida: 60,
      taxaAdministrativaPercentual: 22,
      fundoReservaPercentual: 2,
      seguroPrestamistaPercentual: 0.038,
    });
    expect(est).not.toBeNull();
    const entrada = {
      valorCredito: est!.creditoContratadoEstimado,
      prazoMeses: 220,
      taxaAdministrativaPercentual: 22,
      fundoReservaPercentual: 2,
      seguroPrestamistaPercentual: 0.038,
      reajusteAnualCredito: 6,
      correcaoAnualParcela: 0,
      percentualParcelaInicial: 60,
    };
    const linhas = calcularProjecaoComparativoConsorcio(entrada);
    const linha10 = linhas.find((l) => l.mesesPagosAcumulados === 120);
    const viaHelper = creditoReajustadoAposMesesNaProjecao(linhas, 120);
    expect(viaHelper).toBe(linha10!.creditoEstimadoReajustado);
    expect(viaHelper).toBeCloseTo(
      calcularCreditoReajustado(est!.creditoContratadoEstimado, 6, 10),
      2,
    );
  });

  it("reajuste final usa último ano da projeção (não fração contínua de meses)", () => {
    const credito = 147_022.69;
    const linhas = calcularProjecaoConsorcio({
      valorCredito: credito,
      prazoMeses: 220,
      taxaAdministrativaPercentual: 22,
      fundoReservaPercentual: 2,
      seguroPrestamistaPercentual: 0.038,
      reajusteAnualCredito: 6,
      correcaoAnualParcela: 0,
      percentualParcelaInicial: 60,
    });
    const final = creditoReajustadoFinalConsorcio(linhas);
    const ultima = linhas[linhas.length - 1];
    expect(final).toBe(ultima.creditoEstimadoReajustado);
    expect(final).toBeCloseTo(calcularCreditoReajustado(credito, 6, ultima.ano), 2);
    expect(final!).toBeGreaterThan(credito * Math.pow(1.06, 18));
  });
});
