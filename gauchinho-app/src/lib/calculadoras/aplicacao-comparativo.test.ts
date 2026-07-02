import { describe, expect, it } from "vitest";
import {
  calcularAplicacaoComparativo,
  PERFIS_APLICACAO_CALCULADORA,
  taxaCdiEfetivaAnual,
} from "./aplicacao-comparativo";
import { calcularAplicacaoMensal, aporteMensalNoMes } from "./aplicacao";
import { calcularAplicacaoComConsorcio, leadPayloadAplicacaoConsorcio } from "./aplicacao-consorcio-comparativo";
import { calcularCreditoReajustado, calcularProjecaoConsorcio } from "@/lib/simulador/consorcio";
import { creditoReajustadoAposMesesNaProjecao } from "@/lib/simulador/projecao-financeira";
import {
  cdiAnualReferenciaPercentual,
  taxaMensalAplicacaoFromIndice,
} from "@/lib/indices-financeiros";
import { taxaAnualParaMensalPercentual } from "@/lib/indices-financeiros/math";
import type { IndicePublico } from "@/lib/indices-financeiros/types";

describe("PERFIS_APLICACAO_CALCULADORA", () => {
  it("mantém todos os índices", () => {
    expect(PERFIS_APLICACAO_CALCULADORA).toEqual([
      "poupanca",
      "cdi",
      "selic",
      "tesouro_selic",
      "tesouro_ipca",
      "taxa_manual",
    ]);
  });
});

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

  it("rendimento positivo com taxa e reajuste de aporte", () => {
    const taxa = taxaAnualParaMensalPercentual(15.565);
    const r = calcularAplicacaoMensal({
      valorInicial: 0,
      aporteMensal: 1000,
      prazoMeses: 120,
      taxaMensalPercentual: taxa,
      aumentoAnualAportePercentual: 6,
    });
    expect(r.totalInvestido).toBeGreaterThan(0);
    expect(r.valorFuturo).toBeGreaterThan(r.totalInvestido);
    expect(r.rendimentoEstimado).toBeCloseTo(r.valorFuturo - r.totalInvestido, 2);
    expect(r.rendimentoEstimado).toBeGreaterThan(0);
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
        selic: 0.78,
        tesouro_selic: 0.75,
        tesouro_ipca: 0.6,
        taxa_manual: 0.4,
      },
    });
    expect(r.comparativo.length).toBe(6);
    expect(r.melhorResultadoEstimado).toBe("cdi");
  });
});

describe("taxaCdiEfetivaAnual", () => {
  it("110% do CDI 14,15", () => {
    expect(taxaCdiEfetivaAnual(14.15, 110)).toBeCloseTo(15.565, 3);
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

describe("crédito reajustado — mesma regra do simulador", () => {
  it("período da aplicação (120m) bate com linha 10 anos da projeção", () => {
    const input = {
      valorInicial: 0,
      aporteMensal: 500,
      prazoMeses: 120,
      perfil: "taxa_manual" as const,
      percentualCdi: 100,
      taxaManualMensal: 0.5,
      taxasPorPerfil: { taxa_manual: 0.5 },
      compararComConsorcio: true,
      reajusteAnualCreditoPercentual: 6,
      prazoConsorcioMeses: 220,
      percentualParcelaReduzidaConsorcio: 60,
      taxaAdministrativaConsorcio: 22,
      fundoReservaConsorcio: 2,
      seguroPrestamistaConsorcio: 0.038,
    };
    const r = calcularAplicacaoComConsorcio(input);
    const credito = r.consorcio!.creditoContratadoEstimado;
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
    const esperado = creditoReajustadoAposMesesNaProjecao(linhas, 120);
    expect(r.consorcio!.creditoReajustadoConsorcio).toBeCloseTo(esperado!, 2);
    expect(r.consorcio!.creditoReajustadoConsorcio).toBeCloseTo(
      calcularCreditoReajustado(credito, 6, 10),
      0,
    );
    expect(r.consorcio!.reajusteFinalConsorcio).toBeCloseTo(
      linhas[linhas.length - 1]!.creditoEstimadoReajustado,
      2,
    );
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
    expect(r.consorcio!.periodoComparacaoMeses).toBe(120);
    expect(r.consorcio!.prazoConsorcioMeses).toBe(220);
    expect(r.diferencaPatrimonial).not.toBeNull();
    expect(r.diferencaPatrimonial).toBeCloseTo(
      r.consorcio!.creditoReajustadoConsorcio - r.valorFinalEstimado,
      2,
    );
    const lead = leadPayloadAplicacaoConsorcio(input, r);
    expect(lead.tipo_calculadora).toBe("aplicacao_comparativo_consorcio");
    expect(lead.credito_contratado_estimado).toBeGreaterThan(0);
    expect(lead.rendimento_estimado).toBeGreaterThan(0);
    expect(lead.reajuste_final_consorcio).toBeGreaterThan(lead.credito_reajustado_periodo as number);
  });
});

describe("taxaMensalAplicacaoFromIndice — demais índices", () => {
  const selic: IndicePublico = {
    codigo: "selic",
    nome: "Selic",
    valor_mensal: 1.12,
    valor_anual: 14.25,
    valor_acumulado_12m: null,
    data_referencia: "2026-01-01",
    ultima_atualizacao: null,
    fonte: "test",
    usando_fallback: false,
    atualizacao_automatica: true,
  };

  it("ignora CDI 0,05 como anual", () => {
    const ruim: IndicePublico = {
      codigo: "cdi",
      nome: "CDI",
      valor_mensal: 0.05,
      valor_anual: 0.05,
      valor_acumulado_12m: 0.05,
      data_referencia: "2026-01-01",
      ultima_atualizacao: null,
      fonte: "test",
      usando_fallback: false,
      atualizacao_automatica: true,
    };
    expect(cdiAnualReferenciaPercentual(ruim)).toBeNull();
    expect(taxaMensalAplicacaoFromIndice("cdi", ruim, { percentualCdi: 110 })).toBeNull();
  });

  it("Selic, Poupança e Tesouro retornam taxa mensal", () => {
    expect(taxaMensalAplicacaoFromIndice("selic", selic, {})!).toBeGreaterThan(0);
    const poupanca: IndicePublico = { ...selic, codigo: "poupanca", valor_mensal: 0.58, valor_anual: null };
    expect(taxaMensalAplicacaoFromIndice("poupanca", poupanca, {})!).toBe(0.58);
    const ts: IndicePublico = { ...selic, codigo: "tesouro_selic" };
    expect(taxaMensalAplicacaoFromIndice("tesouro_selic", ts, {})!).toBeGreaterThan(0);
    const ti: IndicePublico = { ...selic, codigo: "tesouro_ipca", valor_anual: 7.5 };
    expect(taxaMensalAplicacaoFromIndice("tesouro_ipca", ti, {})!).toBeGreaterThan(0);
  });
});
