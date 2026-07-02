import { describe, expect, it } from "vitest";
import {
  DEFAULT_FINANCIAMENTO_CONFIG,
  DEFAULT_SIMULADOR_IMOVEL,
} from "@/lib/config/defaults";
import { computeQuickSimulatorResult } from "@/lib/simulador/preview-home";
import { calcularParcelaConsorcio } from "@/lib/simulador/consorcio";
import { simularFinanciamento } from "@/lib/simulador/financiamento";
import { entradaPadraoFinanciamento } from "@/lib/simulador/financiamento-entrada";

import {
  financiamentoConfigParaTipo,
  normalizeFinanciamentoStored,
} from "@/lib/config/financiamento-por-tipo";

const financiamentoStored = normalizeFinanciamentoStored(DEFAULT_FINANCIAMENTO_CONFIG);
const finImovel = financiamentoConfigParaTipo(financiamentoStored, "imovel");

const bundle = {
  imovel: DEFAULT_SIMULADOR_IMOVEL,
  automovel: DEFAULT_SIMULADOR_IMOVEL,
  financiamento: financiamentoStored,
};

describe("preview simulador Home", () => {
  it("consórcio usa mesma fórmula do simulador completo", () => {
    const valor = 500_000;
    const prazo = 180;
    const home = computeQuickSimulatorResult("consorcio", valor, prazo, bundle);
    const integral = calcularParcelaConsorcio({
      valorCredito: valor,
      prazoMeses: home.prazoEfetivo,
      taxaAdministrativaPercentual: bundle.imovel.taxaAdministrativaPadrao,
      fundoReservaPercentual: bundle.imovel.fundoReservaPadrao,
      seguroPrestamistaPercentual: bundle.imovel.seguroPrestamistaPadrao,
      percentualParcelaInicial: 100,
    }).parcelaEstimada;
    const reduzida = calcularParcelaConsorcio({
      valorCredito: valor,
      prazoMeses: home.prazoEfetivo,
      taxaAdministrativaPercentual: bundle.imovel.taxaAdministrativaPadrao,
      fundoReservaPercentual: bundle.imovel.fundoReservaPadrao,
      seguroPrestamistaPercentual: bundle.imovel.seguroPrestamistaPadrao,
      percentualParcelaInicial: 60,
    }).parcelaEstimada;
    expect(home.parcelaIntegral).toBeCloseTo(integral, 2);
    expect(home.parcelaReduzida).toBeCloseTo(reduzida, 2);
    expect(home.parcela).toBeCloseTo(integral, 2);
  });

  it("financiamento usa taxa e entrada da config oficial", () => {
    const valor = 500_000;
    const prazo = finImovel.prazoPadrao;
    const home = computeQuickSimulatorResult("financiamento", valor, prazo, bundle);
    const entrada = entradaPadraoFinanciamento(valor, finImovel);
    const full = simularFinanciamento({
      valorBem: valor,
      entrada,
      taxaMensalPercentual: finImovel.taxaMensalPadrao,
      prazoMeses: home.prazoEfetivo,
    }).parcelaEstimada;
    expect(home.parcela).toBeCloseTo(full, 2);
    expect(home.parcela).toBeGreaterThan(0);
  });
});
