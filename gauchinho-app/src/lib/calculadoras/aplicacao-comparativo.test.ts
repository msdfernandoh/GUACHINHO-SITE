import { describe, expect, it } from "vitest";
import { calcularAplicacaoComparativo, taxaCdiEfetivaAnual } from "./aplicacao-comparativo";
import { aporteMensalNoMes } from "./aplicacao";
import {
  calcularAplicacaoComConsorcio,
  leadPayloadAplicacaoConsorcio,
} from "./aplicacao-consorcio-comparativo";
import { taxaAnualParaMensalPercentual } from "@/lib/indices-financeiros/math";

describe("calcularAplicacaoComparativo", () => {
  it("taxa zero", () => {
    const r = calcularAplicacaoComparativo({
      valorInicial: 1000,
      aporteMensal: 100,
      prazoMeses: 12,
      perfil: "taxa_manual",
      percentualCdi: 100,
      taxasPorPerfil: { taxa_manual: 0 },
    });
    expect(r.valorFinalEstimado).toBe(2200);
    expect(r.rendimentoEstimado).toBe(0);
  });

  it("CDI 100% vs 110%", () => {
    const base = calcularAplicacaoComparativo({
      valorInicial: 0,
      aporteMensal: 100,
      prazoMeses: 24,
      perfil: "cdi",
      percentualCdi: 100,
      taxasPorPerfil: { cdi: 0.8 },
    });
    const maior = calcularAplicacaoComparativo({
      valorInicial: 0,
      aporteMensal: 100,
      prazoMeses: 24,
      perfil: "cdi",
      percentualCdi: 110,
      taxasPorPerfil: { cdi: 0.88 },
    });
    expect(maior.valorFinalEstimado).toBeGreaterThan(base.valorFinalEstimado);
  });

  it("comparativo entre opções", () => {
    const r = calcularAplicacaoComparativo({
      valorInicial: 1000,
      aporteMensal: 0,
      prazoMeses: 12,
      perfil: "comparar_todos",
      percentualCdi: 100,
      taxasPorPerfil: {
        poupanca: 0.5,
        cdi: 0.8,
        tesouro_selic: 0.75,
        tesouro_ipca: 0.6,
        taxa_manual: 0.4,
      },
    });
    expect(r.comparativo.length).toBe(5);
    expect(r.melhorResultadoEstimado).toBe("cdi");
  });
});

describe("taxaCdiEfetivaAnual", () => {
  it("110% do CDI", () => {
    expect(taxaCdiEfetivaAnual(10, 110)).toBe(11);
  });

  it("CDI anual 14,15% → mensal ~1,10%", () => {
    const mensal = taxaAnualParaMensalPercentual(taxaCdiEfetivaAnual(14.15, 100));
    expect(mensal).toBeCloseTo(1.1, 1);
  });
});

describe("aporte reajustado", () => {
  it("meses 1-12 e 13-24 com 6% a.a.", () => {
    expect(aporteMensalNoMes(500, 6, 1)).toBeCloseTo(500, 2);
    expect(aporteMensalNoMes(500, 6, 12)).toBeCloseTo(500, 2);
    expect(aporteMensalNoMes(500, 6, 13)).toBeCloseTo(530, 2);
    expect(aporteMensalNoMes(500, 6, 24)).toBeCloseTo(530, 2);
  });
});

describe("calcularAplicacaoComConsorcio", () => {
  it("diferença patrimonial coerente", () => {
    const input = {
      valorInicial: 0,
      aporteMensal: 500,
      prazoMeses: 120,
      perfil: "taxa_manual" as const,
      percentualCdi: 100,
      taxaManualMensal: 0.5,
      taxasPorPerfil: { taxa_manual: 0.5 },
      aumentoAnualAportePercentual: 6,
      compararComConsorcio: true,
      reajusteAnualCreditoPercentual: 6,
      prazoConsorcioMeses: 220,
      percentualParcelaReduzidaConsorcio: 60,
      taxaAdministrativaConsorcio: 22,
      fundoReservaConsorcio: 2,
      seguroPrestamistaConsorcio: 0.038,
    };
    const r = calcularAplicacaoComConsorcio(input);
    expect(r.consorcio).not.toBeNull();
    expect(r.diferencaPatrimonial).not.toBeNull();
    expect(r.diferencaPatrimonial).toBeCloseTo(
      r.consorcio!.creditoReajustadoConsorcio - r.valorFinalEstimado,
      2,
    );
    const lead = leadPayloadAplicacaoConsorcio(input, r);
    expect(lead.tipo_calculadora).toBe("aplicacao_comparativo_consorcio");
    expect(lead.credito_consorcio_estimado).toBeGreaterThan(0);
  });
});
