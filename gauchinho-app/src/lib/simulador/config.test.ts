import { describe, expect, it } from "vitest";
import {
  DEFAULT_FINANCIAMENTO_CONFIG,
  DEFAULT_SIMULADOR_IMOVEL,
} from "@/lib/config/defaults";
import { getQuickSimDefaults } from "@/lib/simulador/simulador-shared";
import { computeQuickSimulatorResult } from "@/lib/simulador/preview-home";
import { opcoesParcelaAtivas } from "@/lib/config/simulador-parcela-opcoes";
import { calcularParcelaConsorcio } from "@/lib/simulador/consorcio";
import { simularFinanciamento } from "@/lib/simulador/financiamento";
import { entradaPadraoFinanciamento } from "@/lib/simulador/financiamento-entrada";
import { listPrazosFinanciamento, snapPrazoToLista } from "@/lib/simulador/prazos";

const bundle = {
  imovel: DEFAULT_SIMULADOR_IMOVEL,
  automovel: DEFAULT_SIMULADOR_IMOVEL,
  financiamento: DEFAULT_FINANCIAMENTO_CONFIG,
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
    const pct = opcoesParcelaAtivas(bundle.imovel)[0]?.percentual ?? 100;
    const home = computeQuickSimulatorResult("consorcio", valor, prazo, bundle);
    const full = calcularParcelaConsorcio({
      valorCredito: valor,
      prazoMeses: home.prazoEfetivo,
      taxaAdministrativaPercentual: bundle.imovel.taxaAdministrativaPadrao,
      fundoReservaPercentual: bundle.imovel.fundoReservaPadrao,
      seguroPrestamistaPercentual: bundle.imovel.seguroPrestamistaPadrao,
      percentualParcelaInicial: pct,
    }).parcelaEstimada;
    expect(home.parcela).toBeCloseTo(full, 2);
  });

  it("financiamento", () => {
    const valor = 500_000;
    const prazo = 220;
    const home = computeQuickSimulatorResult("financiamento", valor, prazo, bundle);
    const prazos = listPrazosFinanciamento(bundle.financiamento);
    const prazoEfetivo = snapPrazoToLista(prazo, prazos, bundle.financiamento.prazoPadrao);
    const entrada = entradaPadraoFinanciamento(valor, bundle.financiamento);
    const full = simularFinanciamento({
      valorBem: valor,
      entrada,
      taxaMensalPercentual: bundle.financiamento.taxaMensalPadrao,
      prazoMeses: prazoEfetivo,
    }).parcelaEstimada;
    expect(home.ok).toBe(true);
    expect(home.parcela).toBeCloseTo(full, 2);
    expect(home.parcela).toBeGreaterThan(0);
  });

  it("financiamento sem taxa — não retorna parcela zero válida", () => {
    const finZero = { ...bundle.financiamento, taxaMensalPadrao: 0 };
    const r = computeQuickSimulatorResult("financiamento", 500_000, 220, {
      ...bundle,
      financiamento: finZero,
    });
    expect(r.ok).toBe(false);
    expect(r.parcela).toBeNull();
    expect(r.motivo).toMatch(/admin/i);
  });
});
