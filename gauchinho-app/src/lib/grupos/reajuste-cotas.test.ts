import { describe, expect, it } from "vitest";
import {
  aplicarFatorCreditoEmTodas,
  aplicarFatorParcelaEmTodas,
  aplicarPercentualNasCotas,
  fatorFromPercentual,
  percentualFromFator,
} from "./reajuste-cotas";

const cotas = [
  { id: "a", valor_credito: 100_000, valor_parcela: 1_000 },
  { id: "b", valor_credito: 50_000, valor_parcela: 500 },
];

describe("reajuste-cotas", () => {
  it("aplica percentual em crédito e parcela", () => {
    const linhas = aplicarPercentualNasCotas(cotas, 10);
    expect(linhas[0].valor_credito_novo).toBe(110_000);
    expect(linhas[0].valor_parcela_nova).toBe(1_100);
    expect(linhas[1].valor_credito_novo).toBe(55_000);
    expect(linhas[1].valor_parcela_nova).toBe(550);
  });

  it("propaga fator a partir do crédito de uma cota", () => {
    const { percentual, linhas } = aplicarFatorCreditoEmTodas(cotas, "a", 105_000);
    expect(percentual).toBe(5);
    expect(linhas[1].valor_credito_novo).toBe(52_500);
    expect(linhas[1].valor_parcela_nova).toBe(525);
  });

  it("propaga fator a partir da parcela de uma cota", () => {
    const { percentual, linhas } = aplicarFatorParcelaEmTodas(cotas, "b", 525);
    expect(percentual).toBe(5);
    expect(linhas[0].valor_credito_novo).toBe(105_000);
  });

  it("converte percentual ↔ fator", () => {
    expect(fatorFromPercentual(5)).toBe(1.05);
    expect(percentualFromFator(1.05)).toBe(5);
  });
});
