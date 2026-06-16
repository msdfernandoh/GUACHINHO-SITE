import { describe, expect, it } from "vitest";
import {
  DEFAULT_FINANCIAMENTO_CONFIG,
  DEFAULT_SIMULADOR_IMOVEL,
} from "@/lib/config/defaults";
import { computeQuickSimulatorParcela } from "@/lib/simulador/preview-home";
import { calcularParcelaConsorcio } from "@/lib/simulador/consorcio";
import { simularFinanciamento } from "@/lib/simulador/financiamento";

const bundle = {
  imovel: DEFAULT_SIMULADOR_IMOVEL,
  automovel: DEFAULT_SIMULADOR_IMOVEL,
  financiamento: DEFAULT_FINANCIAMENTO_CONFIG,
};

describe("preview simulador Home", () => {
  it("consórcio usa mesma fórmula do simulador completo", () => {
    const valor = 500_000;
    const prazo = 180;
    const home = computeQuickSimulatorParcela("consorcio", valor, prazo, bundle);
    const full = calcularParcelaConsorcio({
      valorCredito: valor,
      prazoMeses: prazo,
      taxaAdministrativaPercentual: bundle.imovel.taxaAdministrativaPadrao,
      fundoReservaPercentual: bundle.imovel.fundoReservaPadrao,
      seguroPrestamistaPercentual: bundle.imovel.seguroPrestamistaPadrao,
      percentualParcelaInicial: 100,
    }).parcelaEstimada;
    expect(home).toBeCloseTo(full, 2);
  });

  it("financiamento usa taxa e entrada da config oficial", () => {
    const valor = 500_000;
    const prazo = bundle.financiamento.prazoPadrao;
    const home = computeQuickSimulatorParcela("financiamento", valor, prazo, bundle);
    const entrada =
      valor * (bundle.financiamento.entradaMinimaSugeridaPercentual / 100);
    const full = simularFinanciamento({
      valorBem: valor,
      entrada,
      taxaMensalPercentual: bundle.financiamento.taxaMensalPadrao,
      prazoMeses: prazo,
    }).parcelaEstimada;
    expect(home).toBeCloseTo(full, 2);
  });
});
