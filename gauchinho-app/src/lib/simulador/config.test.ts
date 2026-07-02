import { describe, expect, it } from "vitest";
import {
  DEFAULT_FINANCIAMENTO_CONFIG,
  DEFAULT_SIMULADOR_IMOVEL,
} from "@/lib/config/defaults";
import { getQuickSimDefaults } from "@/lib/simulador/simulador-shared";
import { computeQuickSimulatorResult } from "@/lib/simulador/preview-home";
import { calcularParcelaConsorcio } from "@/lib/simulador/consorcio";
import { simularFinanciamento } from "@/lib/simulador/financiamento";
import { entradaPadraoFinanciamento } from "@/lib/simulador/financiamento-entrada";
import { listPrazosFinanciamento, snapPrazoToLista } from "@/lib/simulador/prazos";
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

describe("getQuickSimDefaults", () => {
  it("usa prazos do imóvel configurado", () => {
    const d = getQuickSimDefaults(bundle);
    expect(d.prazosConsorcio).toEqual(DEFAULT_SIMULADOR_IMOVEL.prazosDisponiveis?.slice(0, 5));
    expect(d.valorCredito).toBe(DEFAULT_SIMULADOR_IMOVEL.valorPadraoInicial);
  });
});

describe("Home vs simulador completo — mesma parcela", () => {
  it("consórcio", () => {
    const valor = 500_000;
    const prazo = 220;
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
  });

  it("financiamento", () => {
    const valor = 500_000;
    const prazo = 220;
    const home = computeQuickSimulatorResult("financiamento", valor, prazo, bundle);
    const prazos = listPrazosFinanciamento(finImovel);
    const prazoEfetivo = snapPrazoToLista(prazo, prazos, finImovel.prazoPadrao);
    const entrada = entradaPadraoFinanciamento(valor, finImovel);
    const full = simularFinanciamento({
      valorBem: valor,
      entrada,
      taxaMensalPercentual: finImovel.taxaMensalPadrao,
      prazoMeses: prazoEfetivo,
    }).parcelaEstimada;
    expect(home.ok).toBe(true);
    expect(home.parcela).toBeCloseTo(full, 2);
    expect(home.parcela).toBeGreaterThan(0);
  });

  it("financiamento sem taxa — não retorna parcela zero válida", () => {
    const finZeroStored = normalizeFinanciamentoStored({
      ...DEFAULT_FINANCIAMENTO_CONFIG,
      taxaMensalPadrao: 0,
    });
    finZeroStored.imovel = { ...finZeroStored.imovel, taxaMensalPercentual: 0 };
    const r = computeQuickSimulatorResult("financiamento", 500_000, 220, {
      ...bundle,
      financiamento: finZeroStored,
    });
    expect(r.ok).toBe(false);
    expect(r.parcela).toBeNull();
    expect(r.motivo).toMatch(/admin/i);
  });
});
